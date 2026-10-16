import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('tls',{recursive:true});
writeFileSync('deploy/.env.production',`APP_IMAGE=covex-training-manager:ci
PUBLIC_HOST=localhost
APP_PUBLIC_URL=https://localhost:8443
BIND_ADDRESS=127.0.0.1
HTTPS_PORT=8443
TLS_DIRECTORY=./tls
POSTGRES_DB=covex_training_ci
POSTGRES_USER=covex
POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}
AUTH_PROXY_SECRET=${randomBytes(32).toString('hex')}
OAUTH2_PROXY_COOKIE_SECRET=${randomBytes(32).toString('base64url')}
ENTRA_TENANT_ID=11111111-1111-1111-1111-111111111111
ENTRA_CLIENT_ID=22222222-2222-2222-2222-222222222222
ENTRA_CLIENT_SECRET=ci-only
`,{mode:0o600});
