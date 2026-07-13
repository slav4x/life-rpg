#!/usr/bin/env bash
set -euo pipefail

# Restore a PostgreSQL dump created by backup.sh (SPEC §17).
# For a periodic TEST restore, pass a separate target database so production
# data is never touched:
#   set -a && . ./.env && ./scripts/restore.sh /var/backups/life-rpg/daily/x.dump life_rpg_restore_test
#
# Usage: restore.sh <dump-file> [target-db]

dump_file="${1:?usage: restore.sh <dump-file> [target-db]}"
target_db="${2:-${POSTGRES_DB:?set POSTGRES_DB (source your .env)}}"
compose_service="${COMPOSE_SERVICE:-postgres}"
: "${POSTGRES_USER:?set POSTGRES_USER (source your .env)}"

[ -f "$dump_file" ] || { echo "Dump not found: $dump_file" >&2; exit 1; }

echo "Restoring '$dump_file' -> database '$target_db'"

# Ensure the target database exists.
docker compose exec -T "$compose_service" \
  psql -U "$POSTGRES_USER" -d postgres \
  -c "CREATE DATABASE \"$target_db\"" 2>/dev/null || true

docker compose exec -T "$compose_service" \
  pg_restore -U "$POSTGRES_USER" -d "$target_db" --clean --if-exists < "$dump_file"

echo "Restore complete into '$target_db'."
