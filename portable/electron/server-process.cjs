const { spawn } = require("node:child_process");
const net = require("node:net");
const { randomBytes } = require("node:crypto");
const { ORIGIN, PORT, DesktopError, serverEnvironment, verifyReadiness } = require("./settings.cjs");

function checkPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new DesktopError("PORT_IN_USE", `El puerto 127.0.0.1:${PORT} está ocupado. Cierra otra instancia de COVEX; si sigue ocupado, consulta a IT. No se conectará ni se cerrará el proceso ajeno.`)));
    probe.listen({ host: "127.0.0.1", port: PORT, exclusive: true }, () => probe.close(resolve));
  });
}

function within(promise, milliseconds) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), milliseconds);
    promise.then(() => { clearTimeout(timer); resolve(true); });
  });
}

class EmbeddedServer {
  constructor({ executable, entry, runtime, onExit = () => {} }) { this.executable = executable; this.entry = entry; this.runtime = runtime; this.onExit = onExit; this.child = null; this.identity = null; this.mode = null; this.stopping = false; }
  async start(mode, config) {
    if (this.child) throw new DesktopError("ALREADY_RUNNING", "Cierra la aplicación actual antes de cambiar el modo.");
    await checkPort();
    this.identity = { id: randomBytes(24).toString("hex"), token: randomBytes(32).toString("hex") };
    this.mode = mode; this.stopping = false;
    const child = spawn(this.executable, [this.entry, this.runtime], { cwd: require("node:path").dirname(this.runtime), env: serverEnvironment(mode, config, this.identity), stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
    this.child = child;
    let failed = false;
    child.once("error", () => { failed = true; });
    child.once("exit", () => { if (this.child === child) this.child = null; if (!this.stopping) this.onExit(); });
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (failed || child.exitCode !== null || child.signalCode !== null) throw new DesktopError("SERVER_START", "El servicio local no pudo iniciarse. Comprueba que has extraído todas las carpetas del ZIP y revisa antivirus y permisos con IT.");
      const challenge = randomBytes(24).toString("hex");
      try {
        const response = await fetch(`${ORIGIN}/api/portable/desktop-ready`, { headers: { "x-covex-challenge": challenge }, signal: AbortSignal.timeout(1500), redirect: "error" });
        if (response.ok) {
          const result = await response.json();
          if (!verifyReadiness(this.identity, challenge, result, mode) || result.pid !== child.pid) throw new DesktopError("SERVER_IDENTITY", "El servicio del puerto local no pertenece a esta ejecución de COVEX. Cierra otras instancias o consulta a IT.");
          const health = await fetch(`${ORIGIN}/api/health`, { headers: { Cookie: `covex_desktop_instance=${this.identity.token}` }, signal: AbortSignal.timeout(2000), redirect: "error" });
          if (!health.ok) throw new DesktopError("SERVER_CONFIG", "El servicio arrancó, pero su configuración no es válida. Revisa los identificadores públicos con IT.");
          return;
        }
      } catch (error) { if (error instanceof DesktopError) throw error; }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new DesktopError("SERVER_TIMEOUT", "El servicio local no respondió en 60 segundos. Revisa antivirus, extracción del ZIP y permisos del perfil. Puedes reintentar o exportar el diagnóstico.");
  }
  async stop() {
    const child = this.child;
    this.stopping = true;
    if (!child || !child.pid) { this.child = null; this.identity = null; return; }
    const exited = new Promise((resolve) => { child.once("exit", resolve); if (child.exitCode !== null || child.signalCode !== null) resolve(); });
    if (child.connected) child.send({ type: "covex-shutdown" }, () => {});
    const graceful = await within(exited, 5000);
    if (!graceful && child.exitCode === null && child.signalCode === null) child.kill();
    const stopped = await within(exited, 5000);
    if (!stopped) throw new DesktopError("SERVER_CLOSE", "No se pudo confirmar el cierre del servicio propio. Cierra COVEX y solicita a IT revisar sus procesos antes de reabrir.");
    this.child = null; this.identity = null;
  }
}

module.exports = { EmbeddedServer, checkPort };
