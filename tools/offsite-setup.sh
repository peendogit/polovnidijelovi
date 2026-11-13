#!/bin/bash
# Jednokratno podešavanje kopije van servera na Backblaze B2 (prvih 10 GB besplatno).
# Upotreba:  bash tools/offsite-setup.sh
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if ! command -v rclone >/dev/null; then
  echo "Instaliram rclone..."
  apt-get update -qq && apt-get install -y -qq rclone >/dev/null || curl -s https://rclone.org/install.sh | bash
fi

echo
echo "Upiši podatke iz Backblaze (App Keys):"
read -r -p "keyID: " KEYID
read -r -p "applicationKey: " APPKEY
read -r -p "Naziv bucketa (npr. polovnidijelovi-kopija): " BUCKET
[ -z "$KEYID" ] || [ -z "$APPKEY" ] || [ -z "$BUCKET" ] && { echo "STOP: nešto nije upisano."; exit 1; }

rclone config delete pdkopija >/dev/null 2>&1 || true
rclone config create pdkopija b2 account "$KEYID" key "$APPKEY" hard_delete true >/dev/null
echo "Provjeravam pristup..."
if ! rclone lsf "pdkopija:$BUCKET" >/dev/null 2>&1; then
  rclone mkdir "pdkopija:$BUCKET" || { echo "STOP: nema pristupa bucketu. Provjeri keyID, applicationKey i naziv bucketa."; exit 1; }
fi

grep -v '^OFFSITE_REMOTE=' .env > .env.tmp 2>/dev/null || true
echo "OFFSITE_REMOTE=pdkopija:$BUCKET" >> .env.tmp && mv .env.tmp .env

echo "Pravim prvu kopiju (prvi put slike mogu trajati par minuta)..."
bash tools/backup.sh
echo
rclone size "pdkopija:$BUCKET"
echo
echo "GOTOVO: kopija baze i slika ide na Backblaze svaku noć u 3:15."
