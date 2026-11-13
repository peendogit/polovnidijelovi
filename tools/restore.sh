#!/bin/bash
# Vraćanje baze iz kopije.
# Upotreba:  bash tools/restore.sh                 -> pokaže spisak kopija
#            bash tools/restore.sh 2026-11-20      -> vrati kopiju tog dana (lokalnu, ili sa Backblaze ako lokalne nema)
#            bash tools/restore.sh slike           -> vrati sve slike sa Backblaze
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR" || exit 1
REMOTE="$(grep -E '^OFFSITE_REMOTE=' .env 2>/dev/null | cut -d= -f2-)"
if [ -z "$1" ]; then
  echo "Lokalne kopije:"; ls -1 data/backup 2>/dev/null | grep baza- || echo "  nema"
  [ -n "$REMOTE" ] && { echo "Kopije na Backblaze:"; rclone lsf "$REMOTE/baza" | sort; }
  exit 0
fi
if [ "$1" = "slike" ]; then
  [ -z "$REMOTE" ] && { echo "Kopija van servera nije podešena."; exit 1; }
  rclone copy "$REMOTE/slike" data/uploads --transfers 8 && echo "GOTOVO: slike vraćene."; exit 0
fi
F="data/backup/baza-$1.db.gz"
if [ ! -f "$F" ] && [ -n "$REMOTE" ]; then rclone copy "$REMOTE/baza/baza-$1.db.gz" data/backup/; fi
[ -f "$F" ] || { echo "Nema kopije za $1"; exit 1; }
pm2 stop polovnidijelovi >/dev/null
cp data/polovnidijelovi.db "data/polovnidijelovi.db.prije-vracanja-$(date +%F-%H%M)" 2>/dev/null
rm -f data/polovnidijelovi.db-wal data/polovnidijelovi.db-shm
gunzip -c "$F" > data/polovnidijelovi.db
pm2 start polovnidijelovi >/dev/null
echo "GOTOVO: vraćena baza od $1 (stara je sačuvana kao data/polovnidijelovi.db.prije-vracanja-...)."
