#!/usr/bin/env bash
# Обычный деплой/обновление (после init-letsencrypt.sh).
set -euo pipefail
cd "$(dirname "$0")/../.."
exec docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build "$@"
