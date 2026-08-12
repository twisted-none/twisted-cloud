#!/usr/bin/env sh
set -eu

mkdir -p backups
timestamp="$(date +%Y%m%d-%H%M%S)"
file="backups/twisted-vault-${timestamp}.sql"
docker compose exec -T db pg_dump --clean --if-exists -U "${POSTGRES_USER:-vault}" "${POSTGRES_DB:-twisted_vault}" > "$file"
echo "$file"
