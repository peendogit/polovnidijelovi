#!/bin/bash
# Nginx + besplatni HTTPS certifikat za polovnidijelovi.com
# Upotreba:  bash tools/https-setup.sh polovnidijelovi.com
# Prije toga u DNS-u (Namecheap) dodaj A zapise:  @ -> IP servera  i  www -> IP servera
set -e
DOMAIN="${1:-polovnidijelovi.com}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="$(grep -E '^PORT=' "$DIR/.env" 2>/dev/null | cut -d= -f2)"; PORT="${PORT:-3030}"
EMAIL="${2:-autootpaddelic@gmail.com}"

IP_SERVER="$(curl -s -4 ifconfig.me || true)"
IP_DNS="$(getent ahostsv4 "$DOMAIN" | awk '{print $1; exit}')"
echo "Server: $IP_SERVER   |   $DOMAIN pokazuje na: ${IP_DNS:-NIŠTA}"
if [ -z "$IP_DNS" ] || [ "$IP_DNS" != "$IP_SERVER" ]; then
  echo "STOP: $DOMAIN još ne pokazuje na ovaj server. U DNS-u dodaj A zapis -> $IP_SERVER, sačekaj par minuta pa ponovi."
  exit 1
fi

CONF="/etc/nginx/sites-available/polovnidijelovi"
cat > "$CONF" <<NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 10M;
    location /uploads/ {
        alias $DIR/data/uploads/;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
NGINX
ln -sf "$CONF" /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
echo
echo "GOTOVO: https://$DOMAIN"
