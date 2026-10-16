import { spawn } from "node:child_process";
import { readRuntimeConfiguration } from "../../src/config/runtime";
try { readRuntimeConfiguration(); } catch {
  console.error("Configuración de arranque inválida; revisar las variables de implantación.");
  process.exit(1);
}
const child = spawn(process.execPath, [".next/standalone/server.js"], { stdio: "inherit", env: { ...process.env, HOSTNAME: process.env.HOSTNAME || "0.0.0.0" } });
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => child.kill(signal));
child.on("error", () => process.exit(1));
child.on("exit", code => process.exit(code ?? 1));
