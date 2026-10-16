import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDeployment } from '../../scripts/deployment/preflight.mjs';
const env = {APP_IMAGE:'covex:h9a',PUBLIC_HOST:'localhost',APP_PUBLIC_URL:'https://localhost:8443',HTTPS_PORT:'8443',POSTGRES_DB:'covex_training',POSTGRES_USER:'covex',POSTGRES_PASSWORD:'a'.repeat(64),AUTH_PROXY_SECRET:'b'.repeat(64),OAUTH2_PROXY_COOKIE_SECRET:Buffer.alloc(32,1).toString('base64url'),ENTRA_TENANT_ID:'11111111-1111-1111-1111-111111111111',ENTRA_CLIENT_ID:'22222222-2222-2222-2222-222222222222',ENTRA_CLIENT_SECRET:'ci-secret'};
test('complete internal configuration', () => assert.deepEqual(validateDeployment(env), []));
for(const [name,value] of [['AUTH_PROXY_SECRET','weak'],['ENTRA_TENANT_ID','common'],['APP_PUBLIC_URL','http://localhost:8443'],['APP_PUBLIC_URL','https://foreign.invalid'],['POSTGRES_PASSWORD','special:/password'],['PUBLIC_HOST','localhost; return 200;'],['APP_IMAGE','covex:latest'],['HTTPS_PORT','0']]) test(`rejects invalid ${name} ${value}`,()=> assert.ok(validateDeployment({...env,[name]:value}).includes(name)));
