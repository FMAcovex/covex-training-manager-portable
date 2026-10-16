import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const target = process.argv[2] ?? 'deploy/.env.production';
const template = readFileSync(new URL('../../deploy/production.env.example', import.meta.url), 'utf8');
const content = template.replaceAll('REPLACE_WITH_RANDOM_HEX_64', () => randomBytes(32).toString('hex'))
  .replace('REPLACE_WITH_RANDOM_BASE64_32_BYTES', randomBytes(32).toString('base64url'));
writeFileSync(target, content, { flag: 'wx', mode: 0o600 });
console.log('Configuración creada sin mostrar secretos; completar los datos de IT.');
