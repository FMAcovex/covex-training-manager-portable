import { spawn } from "node:child_process";
import electronPath from "electron";

const port = 43110;
const applicationUrl = `http://127.0.0.1:${port}`;
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const next = spawn(pnpm, ["dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: {
    ...process.env,
    APP_ENV: "production",
    AUTH_MODE: "portable-entra",
    PERSISTENCE_PROVIDER: "portable-sharepoint",
    PORTABLE_ENTRA_REDIRECT_URI: process.env.PORTABLE_ENTRA_REDIRECT_URI || `${applicationUrl}/acceso-denegado`,
  },
  stdio: "inherit",
});

async function waitUntilReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${applicationUrl}/api/health`)).ok) return;
    } catch {
      // Next.js is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Next.js no respondió en 60 segundos.");
}

function stop() {
  if (!next.killed) next.kill();
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  await waitUntilReady();
  const electron = spawn(electronPath, ["portable/electron/main.cjs"], {
    env: { ...process.env, PORTABLE_DEV_URL: applicationUrl, PORTABLE_PORT: String(port) },
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve) => electron.once("exit", resolve));
  stop();
  process.exitCode = exitCode ?? 1;
} catch (error) {
  stop();
  throw error;
}
