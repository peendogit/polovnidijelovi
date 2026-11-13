#!/bin/bash
# Noćna kopija: baza (lokalno + van servera) i slike (van servera).
# Cron:  15 3 * * * /var/www/polovnidijelovi/tools/backup.sh >> /var/log/polovnidijelovi-backup.log 2>&1
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR" || exit 1
node --no-warnings tools/backup.js || { echo "$(date '+%F %T') GREŠKA: kopija baze nije napravljena"; exit 1; }

# Van servera (Backblaze B2 preko rclone) — podešava se jednom:  bash tools/offsite-setup.sh
REMOTE="$(grep -E '^OFFSITE_REMOTE=' .env 2>/dev/null | cut -d= -f2-)"
if [ -n "$REMOTE" ] && command -v rclone >/dev/null; then
  # baza: šalju se nove kopije; van servera se čuvaju 90 dana
  rclone copy data/backup "$REMOTE/baza" --include 'baza-*.db.gz' --max-age 3d --quiet \
    && rclone delete "$REMOTE/baza" --min-age 90d --quiet \
    && echo "$(date '+%F %T') baza poslana van servera"
  # slike: šalju se samo nove (obrisane slike ostaju sačuvane van servera)
  rclone copy data/uploads "$REMOTE/slike" --transfers 4 --quiet \
    && echo "$(date '+%F %T') slike poslane van servera"
else
  echo "$(date '+%F %T') kopija van servera nije podešena (bash tools/offsite-setup.sh)"
fi
