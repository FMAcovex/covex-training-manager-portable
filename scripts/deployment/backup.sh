#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
umask 077
mkdir -p backups
BACKUP_PATH="backups/training-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
trap 'rm -f "$BACKUP_PATH.partial"' EXIT
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_PATH.partial"
# Validar el índice antes de publicar un dump completo.
compose exec -T postgres pg_restore --list < "$BACKUP_PATH.partial" > /dev/null
mv "$BACKUP_PATH.partial" "$BACKUP_PATH"
sha256sum "$BACKUP_PATH" > "$BACKUP_PATH.sha256"
printf '%s\n' "$BACKUP_PATH"
