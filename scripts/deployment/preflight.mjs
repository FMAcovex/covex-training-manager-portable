import { readFileSync, statSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
export function validateDeployment(env) {
  const errors = [];
  const required = ['APP_IMAGE','PUBLIC_HOST','APP_PUBLIC_URL','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','AUTH_PROXY_SECRET','OAUTH2_PROXY_COOKIE_SECRET','ENTRA_TENANT_ID','ENTRA_CLIENT_ID','ENTRA_CLIENT_SECRET'];
  for (const name of required) if (!env[name] || /REPLACE_|\.example/.test(env[name])) errors.push(name);
  for (const name of ['POSTGRES_PASSWORD','AUTH_PROXY_SECRET']) if (!/^[a-f0-9]{64}$/.test(env[name] ?? '')) errors.push(name);
  for (const name of ['ENTRA_TENANT_ID','ENTRA_CLIENT_ID']) if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(env[name] ?? '')) errors.push(name);
  for (const name of ['POSTGRES_USER','POSTGRES_DB']) if (!/^[a-z][a-z0-9_]{0,62}$/.test(env[name] ?? '')) errors.push(name);
  if (!/^[a-z0-9.-]+$/.test(env.PUBLIC_HOST ?? '')) errors.push('PUBLIC_HOST');
  if (Buffer.from(env.OAUTH2_PROXY_COOKIE_SECRET ?? '', 'base64url').length !== 32) errors.push('OAUTH2_PROXY_COOKIE_SECRET');
  try {
    const url = new URL(env.APP_PUBLIC_URL);
    if (url.protocol !== 'https:' || url.hostname !== env.PUBLIC_HOST || url.pathname !== '/' || url.search || url.hash || url.username || url.password || (url.port || '443') !== (env.HTTPS_PORT || '443')) errors.push('APP_PUBLIC_URL');
  } catch { errors.push('APP_PUBLIC_URL'); }
  if (!/^\d+$/.test(env.HTTPS_PORT ?? '443') || Number(env.HTTPS_PORT ?? 443) > 65535 || Number(env.HTTPS_PORT ?? 443) < 1) errors.push('HTTPS_PORT');
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(env.BIND_ADDRESS ?? '127.0.0.1')) errors.push('BIND_ADDRESS');
  if (!/^[A-Za-z0-9./:_-]+$/.test(env.APP_IMAGE ?? '') || env.APP_IMAGE?.endsWith(':latest')) errors.push('APP_IMAGE');
  return [...new Set(errors)];
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    const path = process.argv[2] ?? 'deploy/.env.production';
    const env = parseEnv(readFileSync(path, 'utf8'));
    const errors = validateDeployment(env);
    if (errors.length) throw new Error(`Campos pendientes o inválidos: ${errors.join(', ')}`);
    // Compose resolves relative bind sources from the project root (cwd).
    const tls = resolve(env.TLS_DIRECTORY ?? './tls');
    for (const name of ['fullchain.pem','privkey.pem']) statSync(resolve(tls, name));
    if (process.platform !== 'win32' && (statSync(path).mode & 0o077)) throw new Error('Restringir permisos del archivo de variables a 600.');
    console.log('Preflight satisfactorio. Certificado/clave y configuración presentes; vigencia y confianza TLS se verifican por IT.');
  } catch (error) {
    console.error(error instanceof Error && error.message.startsWith('Campos') ? error.message : 'Preflight fallido: revisar variables, permisos y archivos TLS.');
    process.exit(1);
  }
}
