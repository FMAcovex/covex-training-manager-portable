#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
ENV_FILE="${COVEX_DEPLOY_ENV:-deploy/.env.production}"
compose() { docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml "$@"; }
