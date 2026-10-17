import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function dataPath(fileName: string) {
  const directory = process.env.DEMO_DATA_DIR?.trim() || resolve(process.cwd(), ".data");
  return resolve(directory, fileName);
}

export function readDemoJson<T>(fileName: string): T | undefined {
  // Desktop demonstrations never load local files left by a user or another mode.
  if (process.env.PORTABLE_DESKTOP_MODE === "demo") return undefined;
  const path = dataPath(fileName);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new Error(`No se pudo leer el almacenamiento demo ${fileName}: ${error instanceof Error ? error.message : "JSON no válido"}`);
  }
}

export function writeDemoJson(fileName: string, value: unknown) {
  // Existing repositories own their mutable process-local arrays and audit log.
  // Desktop demo deliberately has NO persistence sink (nor filesystem reads).
  // A fresh server process reconstructs the synthetic seed, including counters.
  if (process.env.PORTABLE_DESKTOP_MODE === "demo") return;
  const path = dataPath(fileName);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
}
