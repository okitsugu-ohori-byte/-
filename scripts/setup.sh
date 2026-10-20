#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'if(Number(process.versions.node.split(".")[0])<24)throw new Error("Node.js 24以上を使用してください")'
command -v soffice >/dev/null || { printf '%s\n' 'PPTの画像化にはLibreOfficeが必要です。導入後に再実行してください。' >&2; exit 1; }
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install --cache-dir /tmp/kaden-pip-cache -r requirements.lock
npm ci --cache /tmp/hitachi-npm-cache
npm run build
