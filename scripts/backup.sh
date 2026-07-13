#!/usr/bin/env bash
set -euo pipefail

# PostgreSQL backup with daily / weekly / monthly retention (SPEC §17).
# Run from the project root on the host via a systemd timer or cron, e.g.:
#   0 3 * * *  cd /srv/life-rpg && set -a && . ./.env && ./scripts/backup.sh
#
# Retention: 7 daily, 4 weekly, 6 monthly. Copy at least one backup off-site.

BACKUP_DIR="${BACKUP_DIR:-/var/backups/life-rpg}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-postgres}"
: "${POSTGRES_USER:?set POSTGRES_USER (source your .env)}"
: "${POSTGRES_DB:?set POSTGRES_DB (source your .env)}"

date_stamp="$(date +%F_%H%M%S)"
weekday="$(date +%u)"   # 1 (Mon) .. 7 (Sun)
day_of_month="$(date +%d)"

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly"

daily_file="$BACKUP_DIR/daily/life-rpg-$date_stamp.dump"
echo "Dumping database '$POSTGRES_DB' -> $daily_file"
docker compose exec -T "$COMPOSE_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$daily_file"

# Promote to weekly (Mondays) and monthly (1st of month).
[ "$weekday" = "1" ] && cp "$daily_file" "$BACKUP_DIR/weekly/"
[ "$day_of_month" = "01" ] && cp "$daily_file" "$BACKUP_DIR/monthly/"

# Keep N most recent dumps in each tier.
prune() {
  local dir="$1" keep="$2"
  ls -1t "$dir"/*.dump 2>/dev/null | tail -n "+$((keep + 1))" | xargs -r rm -f
}
prune "$BACKUP_DIR/daily" 7
prune "$BACKUP_DIR/weekly" 4
prune "$BACKUP_DIR/monthly" 6

echo "Backup complete. Remember to replicate a copy off-site."
