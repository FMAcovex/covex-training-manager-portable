const { randomBytes, createHmac, timingSafeEqual } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = 43110;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const REDIRECT_URI = `${ORIGIN}/acceso-denegado`;
const CONFIG_KEYS = ["schemaVersion", "tenantId", "clientId", "siteId", "listPrefix", "driveId", "redirectUri"];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

class DesktopError extends Error {
  constructor(code, message) { super(message); this.name = "DesktopError"; this.code = code; }
}

function validateSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !CONFIG_KEYS.includes(key))) {
    throw new DesktopError("CONFIG_INVALID", "El archivo debe contener solo los identificadores públicos del asistente; no se admiten tokens ni secretos.");
  }
  if (input.schemaVersion !== 1) throw new DesktopError("CONFIG_VERSION", "La versión de configuración no es compatible. Solicita a IT un archivo de versión 1.");
  const result = { schemaVersion: 1 };
  for (const key of CONFIG_KEYS.filter((key) => key !== "schemaVersion")) {
    if (typeof input[key] !== "string" || !input[key].trim() || input[key].length > 500) throw new DesktopError("CONFIG_INVALID", `Completa el identificador público ${key}.`);
    result[key] = input[key].trim();
  }
  if (!UUID.test(result.tenantId) || !UUID.test(result.clientId)) throw new DesktopError("CONFIG_INVALID", "Tenant ID y Client ID deben ser UUID proporcionados por IT.");
  const site = result.siteId.split(",");
  if (site.length !== 3 || !/^[a-z0-9-]+\.sharepoint\.com$/i.test(site[0]) || !site.slice(1).every((part) => UUID.test(part))) throw new DesktopError("CONFIG_INVALID", "Site ID debe tener formato tenant.sharepoint.com,UUID,UUID. Solicita a IT el identificador Graph del sitio.");
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(result.listPrefix)) throw new DesktopError("CONFIG_INVALID", "El prefijo de listas admite entre 1 y 40 letras, números, guiones o guiones bajos.");
  if (!/^[A-Za-z0-9!_-]{10,250}$/.test(result.driveId)) throw new DesktopError("CONFIG_INVALID", "Drive ID debe ser el identificador Graph de la biblioteca, no una URL.");
  if (result.redirectUri !== REDIRECT_URI) throw new DesktopError("CONFIG_INVALID", `La URI registrada por IT debe ser exactamente ${REDIRECT_URI}.`);
  return result;
}

async function loadSettings(directory) {
  const file = path.join(directory, "microsoft365.public.json");
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16_384) throw new DesktopError("CONFIG_INVALID", "La configuración local no es un archivo público válido. Vuelve a importarla desde el asistente.");
    return validateSettings(JSON.parse(await fs.readFile(file, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error instanceof DesktopError) throw error;
    throw new DesktopError("CONFIG_READ", "No se pudo leer la configuración. Revisa los permisos de tu perfil de Windows o vuelve a configurarla.");
  }
}

async function saveSettings(directory, input) {
  const validated = validateSettings(input);
  await fs.mkdir(directory, { recursive: true });
  const destination = path.join(directory, "microsoft365.public.json");
  try { if ((await fs.lstat(destination)).isSymbolicLink()) throw new DesktopError("CONFIG_INVALID", "La configuración no puede ser un enlace simbólico."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const temporary = path.join(directory, `microsoft365.${randomBytes(8).toString("hex")}.tmp`);
  try {
    await fs.writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await fs.rename(temporary, destination);
  } finally { await fs.rm(temporary, { force: true }); }
  return validated;
}

function allowedNavigation(rawUrl, oauth = false) {
  try {
    const url = new URL(rawUrl);
    if (url.username || url.password) return false;
    if (url.origin === ORIGIN) return true;
    return oauth && url.protocol === "https:" && !url.port && ["login.microsoftonline.com", "login.microsoft.com", "sts.windows.net"].includes(url.hostname);
  } catch { return false; }
}

function allowedRequest(rawUrl, oauth = false) {
  if (allowedNavigation(rawUrl, oauth)) return true;
  try {
    const url = new URL(rawUrl);
    return oauth && url.protocol === "https:" && !url.port && !url.username && !url.password && ["aadcdn.msftauth.net", "aadcdn.msauth.net"].includes(url.hostname);
  } catch { return false; }
}

function serverEnvironment(mode, config, identity, inherited = process.env) {
  if (!["demo", "corporate"].includes(mode)) throw new DesktopError("MODE_INVALID", "Selecciona demostración o piloto Microsoft 365.");
  const keep = new Set(["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR"]);
  const env = Object.fromEntries(Object.entries(inherited).filter(([name]) => keep.has(name.toUpperCase())));
  Object.assign(env, {
    ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", HOSTNAME: "127.0.0.1", PORT: String(PORT),
    PORTABLE_DESKTOP_MODE: mode, PORTABLE_DESKTOP_INSTANCE_ID: identity.id, PORTABLE_DESKTOP_INSTANCE_TOKEN: identity.token,
    SHAREPOINT_ENABLED: "false", DATABASE_URL: "", APP_ENV: mode === "corporate" ? "production" : "development",
    AUTH_MODE: mode === "corporate" ? "portable-entra" : "demo", PERSISTENCE_PROVIDER: mode === "corporate" ? "portable-sharepoint" : "demo",
  });
  if (mode === "corporate") {
    const valid = validateSettings(config);
    Object.assign(env, { PORTABLE_ENTRA_TENANT_ID: valid.tenantId, PORTABLE_ENTRA_CLIENT_ID: valid.clientId, PORTABLE_ENTRA_REDIRECT_URI: valid.redirectUri,
      PORTABLE_SHAREPOINT_SITE_ID: valid.siteId, PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID: valid.driveId, PORTABLE_SHAREPOINT_LIST_PREFIX: valid.listPrefix });
  }
  return env;
}

function readinessProof(secret, challenge, id, pid, mode) {
  return createHmac("sha256", secret).update(`${challenge}:${id}:${pid}:${mode}`).digest("hex");
}

function verifyReadiness(identity, challenge, result, mode) {
  if (!result || result.id !== identity.id || result.mode !== mode || !Number.isInteger(result.pid) || !/^[a-f0-9]{64}$/.test(result.proof ?? "")) return false;
  const expected = readinessProof(identity.token, challenge, result.id, result.pid, mode);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(result.proof));
}

module.exports = { PORT, ORIGIN, REDIRECT_URI, DesktopError, validateSettings, loadSettings, saveSettings, allowedNavigation, allowedRequest, serverEnvironment, readinessProof, verifyReadiness };
