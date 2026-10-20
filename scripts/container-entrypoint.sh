#!/bin/sh
set -eu
if [ -z "${APP_PASSWORD:-}" ]; then
  printf '%s\n' 'APP_PASSWORD is required for public deployment.' >&2
  exit 1
fi
case "${DATA_DIR:-/var/data}" in
  /var/data|/var/data/*) ;;
  *) printf '%s\n' 'Set DATA_DIR to /var/data or a child directory for this image.' >&2; exit 1 ;;
esac
mkdir -p "${DATA_DIR:-/var/data}"
chown app:app "${DATA_DIR:-/var/data}"
exec gosu app "$@"
