#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
BACKUP_PATH="${1:?Indicar dump que se verificará en una base temporal}"
sha256sum -c "$BACKUP_PATH.sha256"
RESTORE_DB="covex_restore_check_$(date -u +%Y%m%d%H%M%S)_$$"
cleanup() { compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$1"' sh "$RESTORE_DB"; }
compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$RESTORE_DB"
trap cleanup EXIT
compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --exit-on-error --no-owner --no-acl' sh "$RESTORE_DB" < "$BACKUP_PATH"
compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -c '\''SELECT count(*) AS perfiles FROM "UserProfile"; SELECT count(*) AS formaciones FROM "Training"; SELECT count(*) AS evidencias FROM "DocumentControlAttachment"; SELECT count(*) AS documentos_formadores FROM "TrainerDocument"; SELECT count(*) AS eventos FROM "AuditEvent";'\''' sh "$RESTORE_DB"
printf '%s\n' 'Restauración técnica verificada en base temporal. IT/GC deben revisar integridad funcional y registrar la aceptación.'
