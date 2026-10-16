const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

const port = Number(process.env.PORTABLE_PORT || 43110);
const loopbackOrigin = `http://127.0.0.1:${port}`;
const developmentUrl = process.env.PORTABLE_DEV_URL;
let serverProcess;

function allowedNavigation(rawUrl) {
  if (rawUrl === "about:blank") return true;
  try {
    const url = new URL(rawUrl);
    return url.origin === loopbackOrigin || [
      "login.microsoftonline.com",
      "login.microsoft.com",
      "sts.windows.net",
    ].includes(url.hostname);
  } catch {
    return false;
  }
}

async function waitUntilReady(url) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // The standalone server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("El servidor local no respondió en 60 segundos.");
}

function startStandaloneServer() {
  const server = path.join(__dirname, "runtime", "server.js");
  serverProcess = spawn(process.execPath, [server], {
    cwd: path.dirname(server),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      APP_ENV: "production",
      AUTH_MODE: "portable-entra",
      PERSISTENCE_PROVIDER: "portable-sharepoint",
      PORTABLE_ENTRA_REDIRECT_URI: process.env.PORTABLE_ENTRA_REDIRECT_URI || `${loopbackOrigin}/acceso-denegado`,
    },
    stdio: "ignore",
    windowsHide: true,
  });
  serverProcess.once("exit", (code) => {
    if (code && !app.isQuitting) console.error(`portable_server_exit_${code}`);
  });
}

async function createWindow() {
  const applicationUrl = developmentUrl || loopbackOrigin;
  if (!developmentUrl) startStandaloneServer();
  await waitUntilReady(applicationUrl);

  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => allowedNavigation(url) ? { action: "allow" } : { action: "deny" });
  window.webContents.on("will-navigate", (event, url) => {
    if (!allowedNavigation(url)) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  await window.loadURL(applicationUrl);
}

if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(createWindow).catch((error) => {
  console.error("portable_start_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  app.quit();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  app.isQuitting = true;
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
