#!/bin/bash
# Dnevna kopija baze. Cron:  15 3 * * * /var/www/polovnidijelovi/tools/backup.sh
DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$DIR/data/backup"
sqlite3 "$DIR/data/polovnidijelovi.db" ".backup '$DIR/data/backup/baza-$(date +%F).db'" 2>/dev/null \
  || cp "$DIR/data/polovnidijelovi.db" "$DIR/data/backup/baza-$(date +%F).db"
find "$DIR/data/backup" -name 'baza-*.db' -mtime +14 -delete
