import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function dataPath(fileName: string) {
  const directory = process.env.DEMO_DATA_DIR?.trim() || resolve(process.cwd(), ".data");
  return resolve(directory, fileName);
}

export function readDemoJson<T>(fileName: string): T | undefined {
  const path = dataPath(fileName);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new Error(`No se pudo leer el almacenamiento demo ${fileName}: ${error instanceof Error ? error.message : "JSON no válido"}`);
  }
}

export function writeDemoJson(fileName: string, value: unknown) {
  const path = dataPath(fileName);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
}
