#!/usr/bin/env bash
set -euo pipefail
source scripts/deployment/common.sh
# Preserve production services/network/TLS configuration; replace only the external IdP boundary.
ci_compose() { docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml -f tests/deployment/compose.ci.yml "$@"; }
node scripts/deployment/preflight.mjs "$ENV_FILE"
ci_compose config --quiet
ci_compose up -d --wait postgres redis
ci_compose run --rm migrate
ci_compose run --rm -e BOOTSTRAP_ADMIN_ENTRA_OBJECT_ID=33333333-3333-3333-3333-333333333333 -e BOOTSTRAP_ADMIN_EMAIL=admin@ci.invalid -e BOOTSTRAP_ADMIN_DISPLAY_NAME=CI app pnpm db:bootstrap-admin
ci_compose up -d --wait app oauth2-proxy gateway
ci_compose exec -T gateway nginx -t
ci_compose exec -T app node -e "fetch('http://localhost:3000/api/health').then(async r=>{const b=await r.json();if(r.status!==200||b.database!=='ok'||b.authentication!=='entra-proxy')process.exit(1)})"
test "$(curl -ks -o /dev/null -w '%{http_code}' https://localhost:8443/)" = 302
test "$(curl -ks -o /dev/null -w '%{http_code}' https://localhost:8443/api/trainings -H 'X-MS-CLIENT-PRINCIPAL-ID: 33333333-3333-3333-3333-333333333333' -H 'X-Covex-Proxy-Secret: forged' -H 'X-Covex-Entra-Token: Bearer forged')" = 401
# Authenticated boundary with an invalid token: application must independently deny it.
test "$(curl -ks -o /dev/null -w '%{http_code}' https://localhost:8443/api/trainings -H 'Cookie: ci=invalid')" = 401
# Backend is deliberately unpublished; direct header spoof is still rejected inside the app network.
ci_compose exec -T app node -e "fetch('http://localhost:3000/api/trainings',{headers:{'x-ms-client-principal-id':'33333333-3333-3333-3333-333333333333'}}).then(r=>{if(r.status!==401)process.exit(1)})"
ci_compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -Atc '\''SELECT count(*) FROM "UserProfile";'\''' | grep -qx 1
ci_compose restart app
ci_compose up -d --wait app gateway
ci_compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -Atc '\''SELECT count(*) FROM "UserProfile";'\''' | grep -qx 1
BACKUP_PATH="$(bash scripts/deployment/backup.sh)"
bash scripts/deployment/restore-check.sh "$BACKUP_PATH"
# Fail-closed production start, no valid DB or tenant; no network server may start.
if docker run --rm -e APP_ENV=production -e AUTH_MODE=demo covex-training-manager:ci; then
  printf '%s\n' 'ERROR: se ha permitido un arranque demo productivo'; exit 1
fi
# Verify actual oauth2-proxy flags offline. Real tenant sign-in remains an IT acceptance test.
docker run --rm --network covex-training-production_identity quay.io/oauth2-proxy/oauth2-proxy:v7.15.5 --config-test \
  --provider=entra-id --client-id=22222222-2222-2222-2222-222222222222 --client-secret=ci-only \
  --cookie-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= --email-domain='*' \
  --oidc-issuer-url=https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0 \
  --skip-oidc-discovery=true --login-url=https://localhost/authorize --redeem-url=https://localhost/token --oidc-jwks-url=https://localhost/keys \
  --set-authorization-header=true --reverse-proxy=true --session-store-type=redis --redis-connection-url=redis://redis:6379/0 \
  --code-challenge-method=S256 --insecure-oidc-skip-nonce=false
# Verify non-empty binary data survives the same backup format in a fresh isolated database.
ci_compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' <<'SQL'
INSERT INTO "Person" (id,"fullName","personType","jobTitle","updatedAt") VALUES ('ci-person','CI ficticio','EXTERNAL','CI',CURRENT_TIMESTAMP);
INSERT INTO "TrainerDocument" (id,"personId","fileName","mimeType","sizeBytes",content,"uploadedByUserId") VALUES ('ci-document','ci-person','ci.txt','text/plain',4,decode('434f5645','hex'),'ci-actor');
SQL
BINARY_BACKUP="$(bash scripts/deployment/backup.sh)"
BINARY_DB=covex_binary_restore_ci
ci_compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$BINARY_DB"
ci_compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --exit-on-error --no-owner --no-acl' sh "$BINARY_DB" < "$BINARY_BACKUP"
ci_compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -At' sh "$BINARY_DB" <<'SQL' | grep -qx 434f5645
SELECT encode(content, 'hex') FROM "TrainerDocument" WHERE id='ci-document';
SQL
ci_compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" "$1"' sh "$BINARY_DB"
printf '%s\n' 'Smoke de despliegue H9A satisfactorio; pendiente autenticación corporativa y aceptación IT.'
