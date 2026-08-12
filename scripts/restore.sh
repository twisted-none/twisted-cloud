#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/restore.sh backups/twisted-vault-YYYYmmdd-HHMMSS.sql" >&2
  exit 1
fi

docker compose exec -T db psql -U "${POSTGRES_USER:-vault}" "${POSTGRES_DB:-twisted_vault}" < "$1"
