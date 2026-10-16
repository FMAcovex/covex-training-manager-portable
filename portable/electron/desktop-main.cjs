const { app, BrowserWindow, Menu, ipcMain, dialog, clipboard, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { randomBytes } = require("node:crypto");
const { ORIGIN, REDIRECT_URI, DesktopError, loadSettings, saveSettings, validateSettings, allowedNavigation, allowedRequest } = require("./settings.cjs");
const { EmbeddedServer } = require("./server-process.cjs");

app.setName("COVEX Training Manager Portable");
app.setPath("userData", path.join(app.getPath("appData"), "COVEX Training Manager Portable"));
const launcherURL = pathToFileURL(path.join(__dirname, "launcher.html")).href;
let launcher, application, appSession, closing = false, busy = false, configuration = null;
let status = { phase: "ready", message: "Selecciona demostración o configura el piloto Microsoft 365.", code: null, mode: null };
const events = [];
const server = new EmbeddedServer({ executable: process.execPath, entry: path.join(__dirname, "server-entry.cjs"), runtime: path.join(__dirname, "runtime", "server.js"), onExit: () => {
  if (closing) return;
  change({ phase: "error", code: "SERVER_EXIT", message: "El servicio local se ha cerrado. Revisa antivirus y extracción del ZIP; puedes reintentar o exportar el diagnóstico." });
  if (application && !application.isDestroyed()) { const window = application; application = null; window.destroy(); }
  launcher?.show();
} });

function snapshot() { return { ...status, busy, configuration, redirectUri: REDIRECT_URI, version: app.getVersion(), noGo: true, serverRunning: Boolean(server.child) }; }
function change(update) {
  status = { ...status, ...update };
  events.push({ at: new Date().toISOString(), phase: status.phase, code: status.code, mode: status.mode });
  if (events.length > 40) events.shift();
  if (launcher && !launcher.isDestroyed()) launcher.webContents.send("covex:state-changed", snapshot());
}
function diagnostic() { return { product: "COVEX Training Manager Portable", version: app.getVersion(), platform: process.platform, architecture: process.arch, candidate: "NO-GO corporativo / GMP", phase: status.phase, code: status.code, mode: status.mode, configurationPresent: Boolean(configuration), serverRunning: Boolean(server.child), events }; }
function showFailure(error) { change({ phase: "error", code: error instanceof DesktopError ? error.code : "DESKTOP_ERROR", message: error instanceof DesktopError ? error.message : "No se pudo completar la operación. Revisa permisos, extracción y antivirus; exporta el diagnóstico para IT." }); }
async function task(operation) {
  if (busy) return { ok: false, error: "Hay una operación en curso. Espera a que termine.", state: snapshot() };
  busy = true; change({});
  let result;
  try { result = { ok: true, value: await operation() }; }
  catch (error) { showFailure(error); result = { ok: false, error: status.message }; }
  finally { busy = false; change({}); }
  return { ...result, state: snapshot() };
}
function privileged(event) { return launcher && !launcher.isDestroyed() && event.sender === launcher.webContents && event.senderFrame === launcher.webContents.mainFrame && event.senderFrame.url === launcherURL; }
function handle(name, action) { ipcMain.handle(`covex:${name}`, (event, payload) => { if (!privileged(event)) throw new Error("Desktop IPC denied"); return action(payload); }); }
function harden(window, oauth = false) {
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("will-navigate", (event, url) => { if (!allowedNavigation(url, oauth)) event.preventDefault(); });
  window.webContents.on("will-redirect", (event, url) => { if (!allowedNavigation(url, oauth)) event.preventDefault(); });
  window.webContents.setWindowOpenHandler(({ url }) => {
    const allow = !oauth && status.mode === "corporate" && (url === "about:blank" || allowedNavigation(url, true));
    return allow ? { action: "allow", overrideBrowserWindowOptions: { webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, session: appSession } } } : { action: "deny" };
  });
  window.webContents.on("did-create-window", (child) => harden(child, true));
}
async function stopApplication() {
  if (application && !application.isDestroyed()) { const window = application; application = null; window.destroy(); }
  await server.stop();
  if (appSession) { await appSession.clearStorageData(); appSession = null; }
}
async function returnToLauncher() { await task(async () => { change({ phase: "stopping", message: "Cerrando el servicio local y la sesión…" }); await stopApplication(); change({ phase: "ready", code: null, message: "Servicio cerrado. Puedes cambiar de modo o configurar Microsoft 365.", mode: null }); launcher.show(); }); }
async function start(mode, acknowledged) {
  if (mode !== "demo" && mode !== "corporate") throw new DesktopError("MODE_INVALID", "Selecciona un modo válido.");
  if (mode === "corporate" && acknowledged !== true) throw new DesktopError("NO_GO", "El piloto solo admite datos sintéticos hasta la validación real de IT y Calidad. Confirma este límite.");
  if (mode === "corporate" && !configuration) throw new DesktopError("CONFIG_MISSING", "Completa y guarda los identificadores públicos proporcionados por IT.");
  change({ phase: "starting", mode, code: null, message: "Comprobando el puerto e iniciando COVEX…" });
  try {
    await server.start(mode, configuration);
    if (closing) throw new DesktopError("CLOSING", "COVEX se está cerrando.");
    appSession = session.fromPartition(`covex-${randomBytes(16).toString("hex")}`);
    appSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    appSession.setPermissionCheckHandler(() => false);
    appSession.webRequest.onBeforeRequest((details, callback) => {
      if (details.url.startsWith("blob:") || details.url.startsWith("data:")) return callback({ cancel: false });
      callback({ cancel: !allowedRequest(details.url, mode === "corporate") });
    });
    await appSession.cookies.set({ url: ORIGIN, name: "covex_desktop_instance", value: server.identity.token, httpOnly: true, sameSite: "strict", path: "/", secure: false });
    const window = new BrowserWindow({ title: mode === "demo" ? "COVEX — DEMO — DATOS FICTICIOS" : "COVEX — Piloto NO-GO corporativo / GMP", width: 1440, height: 920, minWidth: 1024, minHeight: 700, show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, session: appSession } });
    application = window;
    harden(window);
    window.once("closed", () => { if (application !== window) return; application = null; if (!closing) void returnToLauncher(); });
    await window.loadURL(ORIGIN);
    window.show(); launcher.hide();
    change({ phase: "running", code: null, message: mode === "demo" ? "DEMO — DATOS FICTICIOS. Navegación y anexos; sin importación ni carga de archivos." : "Piloto Microsoft 365. NO-GO para datos corporativos y GMP.", mode });
  } catch (error) { await stopApplication(); throw error; }
}
async function exportJSON(value, fileName) {
  const result = await dialog.showSaveDialog(launcher, { title: "Guardar archivo público / diagnóstico", defaultPath: fileName, filters: [{ name: "JSON", extensions: ["json"] }] });
  if (!result.canceled && result.filePath) await fs.writeFile(result.filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  return !result.canceled;
}
function installIPC() {
  handle("state", () => ({ ok: true, state: snapshot() }));
  handle("save", (input) => task(async () => { if (server.child) throw new DesktopError("ALREADY_RUNNING", "Cierra la aplicación antes de cambiar la configuración."); configuration = await saveSettings(app.getPath("userData"), input); change({ phase: "ready", code: null, message: "Configuración pública guardada. El acceso y los permisos reales siguen pendientes de IT." }); }));
  handle("start", (input) => task(() => start(input?.mode, input?.acknowledged)));
  handle("import-settings", () => task(async () => {
    if (server.child) throw new DesktopError("ALREADY_RUNNING", "Cierra la aplicación antes de importar la configuración.");
    const selected = await dialog.showOpenDialog(launcher, { title: "Importar configuración pública Microsoft 365", filters: [{ name: "Configuración JSON", extensions: ["json"] }], properties: ["openFile"] });
    if (selected.canceled) return;
    const file = selected.filePaths[0]; const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16_384) throw new DesktopError("CONFIG_INVALID", "Selecciona un JSON público de menos de 16 KB.");
    let parsed; try { parsed = JSON.parse(await fs.readFile(file, "utf8")); } catch { throw new DesktopError("CONFIG_INVALID", "El archivo no es JSON válido. Solicita a IT la configuración pública."); }
    configuration = await saveSettings(app.getPath("userData"), validateSettings(parsed)); change({ phase: "ready", code: null, message: "Configuración pública importada; conexión corporativa aún no validada." });
  }));
  handle("export-settings", () => task(() => { if (!configuration) throw new DesktopError("CONFIG_MISSING", "Guarda primero la configuración pública."); return exportJSON(configuration, "COVEX-Microsoft365-publica.json"); }));
  handle("copy-diagnostic", () => { clipboard.writeText(JSON.stringify(diagnostic(), null, 2)); return { ok: true, value: "Diagnóstico redactado copiado.", state: snapshot() }; });
  handle("export-diagnostic", () => task(() => exportJSON(diagnostic(), "COVEX-diagnostico-redactado.json")));
  handle("connectivity", () => task(async () => {
    if (!configuration) throw new DesktopError("CONFIG_MISSING", "Guarda primero los identificadores de IT.");
    const urls = [`https://login.microsoftonline.com/${configuration.tenantId}/v2.0/.well-known/openid-configuration`, "https://graph.microsoft.com/v1.0/$metadata"];
    const checks = await Promise.all(urls.map(async (url) => { try { const result = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "error" }); return result.ok; } catch { return false; } }));
    change({ phase: "ready", code: checks.every(Boolean) ? null : "NETWORK_CHECK", message: checks.every(Boolean) ? "Entra y Graph responden. Esto no valida inicio de sesión, permisos ni almacenamiento SharePoint." : "No se pudo confirmar acceso a Entra o Graph. IT debe revisar Internet, proxy, certificados y política de red; puedes reintentar." });
  }));
}
async function main() {
  launcher = new BrowserWindow({ title: "COVEX Training Manager Portable — Inicio", width: 1080, height: 900, minWidth: 900, minHeight: 700, show: false,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  launcher.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  launcher.webContents.on("will-navigate", (event, url) => { if (url !== launcherURL) event.preventDefault(); });
  launcher.webContents.on("will-attach-webview", (event) => event.preventDefault());
  launcher.on("close", () => { if (!closing) app.quit(); });
  installIPC();
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: "COVEX", submenu: [
    { label: "Configuración / cambiar de modo", click: () => void returnToLauncher() },
    { label: "Copiar diagnóstico redactado", click: () => clipboard.writeText(JSON.stringify(diagnostic(), null, 2)) },
    { type: "separator" }, { label: "Salir de COVEX", click: () => app.quit() },
  ] }]));
  try { configuration = await loadSettings(app.getPath("userData")); } catch (error) { showFailure(error); }
  await launcher.loadURL(launcherURL); launcher.show();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { const window = application || launcher; if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.on("before-quit", (event) => {
    if (closing) return;
    event.preventDefault(); closing = true;
    void stopApplication().then(() => app.exit(0)).catch(() => { dialog.showErrorBox("COVEX — cierre incompleto", "No se pudo confirmar el cierre del servicio propio. Solicita a IT comprobar procesos antes de reabrir COVEX."); app.exit(1); });
  });
  app.on("window-all-closed", () => app.quit());
  app.whenReady().then(main).catch((error) => { showFailure(error); dialog.showErrorBox("COVEX — no se pudo iniciar", status.message); app.quit(); });
}
