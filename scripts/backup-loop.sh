#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
BACKUP_KEEP_COUNT="${BACKUP_KEEP_COUNT:-30}"

mkdir -p "$BACKUP_DIR"

latest_backup_mtime() {
  latest="$(ls -1t "$BACKUP_DIR"/twisted-vault-*.sql 2>/dev/null | head -n 1 || true)"
  if [ -z "$latest" ]; then
    echo 0
    return
  fi
  stat -c %Y "$latest"
}

prune_old_backups() {
  ls -1t "$BACKUP_DIR"/twisted-vault-*.sql 2>/dev/null | tail -n +"$((BACKUP_KEEP_COUNT + 1))" | xargs -r rm -f
}

create_backup() {
  timestamp="$(date +%Y%m%d-%H%M%S)"
  tmp_file="$BACKUP_DIR/.twisted-vault-${timestamp}.sql.tmp"
  final_file="$BACKUP_DIR/twisted-vault-${timestamp}.sql"
  rm -f "$tmp_file"
  pg_dump --clean --if-exists > "$tmp_file"
  mv "$tmp_file" "$final_file"
  echo "Created backup: $final_file"
  prune_old_backups
}

while true; do
  now="$(date +%s)"
  latest_mtime="$(latest_backup_mtime)"
  elapsed="$((now - latest_mtime))"
  if [ "$elapsed" -ge "$BACKUP_INTERVAL_SECONDS" ]; then
    create_backup
    sleep "$BACKUP_INTERVAL_SECONDS"
  else
    sleep_for="$((BACKUP_INTERVAL_SECONDS - elapsed))"
    echo "Latest backup is ${elapsed}s old; next backup in ${sleep_for}s"
    sleep "$sleep_for"
  fi
done
