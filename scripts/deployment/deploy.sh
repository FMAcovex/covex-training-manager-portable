#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
node scripts/deployment/preflight.mjs "$ENV_FILE"
compose config --quiet
compose build app
compose up -d --wait postgres redis
# No seed demo; las migraciones se aplican antes de iniciar/recrear la app.
compose run --rm migrate
compose up -d --wait app oauth2-proxy gateway
compose exec -T gateway nginx -t
printf '%s\n' 'Despliegue preparado. Completar bootstrap y aceptación con IT/GC antes del uso real.'
