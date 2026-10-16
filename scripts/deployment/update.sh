#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
# Ejecutar desde el checkout de la versión aprobada, con APP_IMAGE versionada.
node scripts/deployment/preflight.mjs "$ENV_FILE"
bash scripts/deployment/backup.sh
compose build app
compose stop gateway app
compose run --rm migrate
compose up -d --wait app oauth2-proxy gateway
printf '%s\n' 'Actualización completada; verificar Entra, datos, anexos y adjuntos antes de reabrir el servicio.'
