FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
# Optional trust mounts are used only by the managed development environment.
# Render's build uses the image's normal trust roots.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --offline --ignore-scripts --no-audit

FROM python:3.12-slim-bookworm AS runtime
ENV NODE_ENV=production \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHON_BIN=/opt/venv/bin/python \
    PORT=10000 \
    HOST=0.0.0.0 \
    DATA_DIR=/var/data \
    HOME=/home/app
RUN --mount=type=secret,id=proxy_ca_bundle \
    if [ -f /run/secrets/proxy_ca_bundle ]; then \
      printf 'Acquire::https::CaInfo "/run/secrets/proxy_ca_bundle";\n' > /etc/apt/apt.conf.d/99-build-ca; \
    fi; \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libreoffice-impress fonts-noto-cjk tini gosu && \
    rm -f /etc/apt/apt.conf.d/99-build-ca && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.lock ./
RUN --mount=type=secret,id=proxy_ca_bundle \
    python -m venv /opt/venv && \
    if [ -f /run/secrets/proxy_ca_bundle ]; then export PIP_CERT=/run/secrets/proxy_ca_bundle; fi; \
    /opt/venv/bin/python -m pip install --no-cache-dir -r requirements.lock
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend /app/node_modules ./node_modules
COPY --from=frontend /app/dist ./dist
COPY package.json ./
COPY server ./server
COPY scripts ./scripts
RUN groupadd --gid 10001 app && \
    useradd --uid 10001 --gid 10001 --create-home --home-dir /home/app app && \
    mkdir -p /var/data && chown app:app /var/data && \
    chmod -R a+rX /app && \
    chmod 755 /app/scripts/container-entrypoint.sh
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=8s --start-period=30s --retries=3 \
    CMD ["node", "scripts/healthcheck.mjs"]
ENTRYPOINT ["/usr/bin/tini", "--", "/app/scripts/container-entrypoint.sh"]
CMD ["node", "scripts/start-public.mjs"]
