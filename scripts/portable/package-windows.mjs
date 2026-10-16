import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { packager } from "@electron/packager";

const root = process.cwd();
const staging = path.join(root, "tmp", "portable-electron-app");
const runtime = path.join(staging, "runtime");
const output = path.join(root, "dist-portable");
const rootPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

await rm(staging, { recursive: true, force: true });
await mkdir(runtime, { recursive: true });
await cp(path.join(root, "portable", "electron", "main.cjs"), path.join(staging, "main.cjs"));
await cp(path.join(root, ".next", "standalone"), runtime, { recursive: true });
await mkdir(path.join(runtime, ".next"), { recursive: true });
await cp(path.join(root, ".next", "static"), path.join(runtime, ".next", "static"), { recursive: true });
await cp(path.join(root, "public"), path.join(runtime, "public"), { recursive: true });
await writeFile(path.join(staging, "package.json"), JSON.stringify({
  name: "covex-training-manager-portable",
  productName: "COVEX Training Manager Portable",
  version: rootPackage.version,
  author: "COVEX",
  main: "main.cjs",
}, null, 2));

const paths = await packager({
  dir: staging,
  out: output,
  overwrite: true,
  platform: "win32",
  arch: "x64",
  name: "COVEX Training Manager Portable",
  appVersion: rootPackage.version,
  electronVersion: rootPackage.devDependencies.electron.replace(/^[^0-9]*/, ""),
  download: { cacheRoot: path.join(root, "tmp", "electron-cache") },
  asar: false,
  prune: false,
});

for (const packagedPath of paths) console.log(`Windows portable package: ${packagedPath}`);
