#!/usr/bin/env bash
# Первичный Let's Encrypt (webroot). Запуск из корня репозитория:
#   bash deploy/scripts/init-letsencrypt.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE=(docker compose --env-file .env.prod -f docker-compose.prod.yml)
TPL="$REPO_ROOT/deploy/nginx/templates"
HTTPS_TPL="$REPO_ROOT/deploy/nginx/chesscast-https.conf.template"

if [[ ! -f .env.prod ]]; then
  echo "Создайте .env.prod: cp deploy/env.prod.example .env.prod"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.prod
set +a

: "${DOMAIN:?DOMAIN в .env.prod}"
: "${CERT_EMAIL:?CERT_EMAIL в .env.prod (для Let's Encrypt)}"

CERT_NAME="${CERT_NAME:-$DOMAIN}"
STAGING="${CERT_STAGING:-0}"

echo "==> Сборка и запуск приложения..."
"${COMPOSE[@]}" build backend frontend
"${COMPOSE[@]}" up -d postgres redis elasticsearch backend frontend

echo "==> Nginx (HTTP, ACME)..."
cp "$TPL/chesscast.conf.template" "$TPL/chesscast.conf.template.bak" 2>/dev/null || true
# chesscast.conf.template уже HTTP-only в репозитории
"${COMPOSE[@]}" up -d nginx

STAGING_ARG=()
[[ "$STAGING" == "1" ]] && STAGING_ARG=(--staging)

echo "==> Certbot для $DOMAIN ..."
"${COMPOSE[@]}" run --rm certbot certonly --webroot -w /var/www/certbot \
  "${STAGING_ARG[@]}" \
  --email "$CERT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo "==> Включаем HTTPS..."
cp "$HTTPS_TPL" "$TPL/chesscast.conf.template"
"${COMPOSE[@]}" up -d --force-recreate nginx certbot

echo ""
echo "Готово: https://$DOMAIN"
echo "Webhook ЮKassa: https://$DOMAIN/api/payments/yookassa/webhook"
