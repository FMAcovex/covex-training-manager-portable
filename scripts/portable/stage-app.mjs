import { cp, mkdir, readFile, rm, writeFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";

export const root = process.cwd();
export const staging = path.join(root, "tmp", "portable-electron-app");
export const output = path.join(root, "dist-portable");
const excluded = new Set(["tests", "__tests__", "coverage", ".data", ".git", ".pnpm", "tmp"]);
export function allowedRuntimeFile(file) {
  const name = path.basename(file);
  return !excluded.has(name) && name !== ".env" && !name.startsWith(".env.") && !/\.(pem|key|pfx|p12|dump|sql|tsbuildinfo)$/i.test(name);
}

export async function inventory(directory, relative = "") {
  const result = [];
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    const stat = await lstat(path.join(directory, file));
    if (stat.isSymbolicLink()) throw new Error(`Portable runtime contains a symbolic link: ${file}`);
    if (entry.isDirectory()) result.push(...await inventory(directory, file));
    else result.push({ file: file.split(path.sep).join("/"), bytes: stat.size });
  }
  return result.sort((a, b) => a.file.localeCompare(b.file));
}

// Dereferencing pnpm's top-level links alone loses sibling dependencies of Next.
// Materialize every traced package at the runtime root, with no Windows symlinks.
// Fail on conflicting versions instead of silently choosing an incompatible one.
export async function materializeTracedPackages(sourceModules, destinationModules) {
  const store = path.join(sourceModules, ".pnpm");
  let stores;
  try { stores = await readdir(store); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  const versions = new Map();
  async function copyPackage(source, name) {
    if (!(await lstat(source)).isDirectory()) return;
    let version = "generated";
    try { version = JSON.parse(await readFile(path.join(source, "package.json"), "utf8")).version ?? version; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (versions.has(name) && versions.get(name) !== version) throw new Error(`Conflicting traced runtime versions for ${name}`);
    versions.set(name, version);
    await cp(source, path.join(destinationModules, name), { recursive: true, dereference: true, filter: allowedRuntimeFile });
  }
  for (const item of stores) {
    const modules = path.join(store, item, "node_modules");
    let entries;
    try { entries = await readdir(modules, { withFileTypes: true }); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const source = path.join(modules, entry.name);
      if (entry.name.startsWith("@")) {
        for (const child of await readdir(source, { withFileTypes: true })) if (child.isDirectory()) await copyPackage(path.join(source, child.name), `${entry.name}/${child.name}`);
      } else await copyPackage(source, entry.name);
    }
  }
}

export async function stageApp() {
  const rootPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const runtime = path.join(staging, "runtime");
  await rm(staging, { recursive: true, force: true });
  await mkdir(runtime, { recursive: true });
  for (const file of ["main.cjs", "desktop-main.cjs", "settings.cjs", "server-process.cjs", "server-entry.cjs", "preload.cjs", "launcher.html", "launcher.css", "launcher.js"]) await cp(path.join(root, "portable/electron", file), path.join(staging, file));
  await cp(path.join(root, "public/brand/covex-logo.jpg"), path.join(staging, "covex-logo.jpg"));
  await cp(path.join(root, ".next/standalone"), runtime, { recursive: true, dereference: true, filter: allowedRuntimeFile });
  await materializeTracedPackages(path.join(root, ".next/standalone/node_modules"), path.join(runtime, "node_modules"));
  await mkdir(path.join(runtime, ".next"), { recursive: true });
  await cp(path.join(root, ".next/static"), path.join(runtime, ".next/static"), { recursive: true, dereference: true, filter: allowedRuntimeFile });
  await cp(path.join(root, "public"), path.join(runtime, "public"), { recursive: true, dereference: true, filter: allowedRuntimeFile });
  await writeFile(path.join(staging, "package.json"), JSON.stringify({ name: "covex-training-manager-portable", productName: "COVEX Training Manager Portable", version: rootPackage.version, author: "COVEX", main: "main.cjs" }, null, 2));
  await cp(path.join(root, "docs/GUIA_INICIO_WINDOWS.md"), path.join(staging, "README_INICIO_WINDOWS.md"));
  const files = await inventory(staging);
  if (files.some((entry) => entry.file.split("/").some((part) => !allowedRuntimeFile(part)))) throw new Error("Portable runtime contains excluded files");
  for (const required of ["runtime/server.js", "runtime/.next/server/app/api/portable/desktop-ready/route.js", "preload.cjs", "launcher.html"]) if (!files.some((entry) => entry.file === required)) throw new Error(`Missing portable resource: ${required}`);
  return { rootPackage, files };
}
