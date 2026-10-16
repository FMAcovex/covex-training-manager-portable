import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { packager } from "@electron/packager";
import { root, staging, output, stageApp, inventory } from "./stage-app.mjs";

const { rootPackage } = await stageApp();
await mkdir(output, { recursive: true });
const paths = await packager({
  dir: staging, out: output, overwrite: true, platform: "win32", arch: "x64", name: "COVEX Training Manager Portable",
  appVersion: rootPackage.version, electronVersion: rootPackage.devDependencies.electron.replace(/^[^0-9]*/, ""),
  download: { cacheRoot: path.join(root, "tmp/electron-cache") }, asar: false, prune: false,
});
const version = rootPackage.version;
const archiveName = `COVEX-Training-Manager-Portable-${version}-windows-x64.zip`;
const archive = path.join(output, archiveName);
const appDirectory = paths[0];
await cp(path.join(root, "docs/GUIA_INICIO_WINDOWS.md"), path.join(appDirectory, "README_INICIO_WINDOWS.md"));
const files = await inventory(appDirectory);
const manifest = { product: "COVEX Training Manager Portable", version, candidate: true, status: "NO-GO para datos corporativos y GMP", platform: "win32-x64", electron: rootPackage.devDependencies.electron, nodeRequiredOnUserComputer: false, runtimeDirectoryRequired: true, sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), files };
await writeFile(path.join(appDirectory, "BUILD_MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
// A rebuild must not retain obsolete entries from an earlier archive.
await rm(archive, { force: true });
const command = process.platform === "win32"
  ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Compress-Archive -LiteralPath $env:COVEX_ARCHIVE_SOURCE -DestinationPath $env:COVEX_ARCHIVE_TARGET -Force"], { env: { ...process.env, COVEX_ARCHIVE_SOURCE: appDirectory, COVEX_ARCHIVE_TARGET: archive }, stdio: "inherit" })
  : spawnSync("zip", ["-q", "-r", archive, path.basename(appDirectory)], { cwd: output, stdio: "inherit" });
if (command.status !== 0) throw new Error("Portable ZIP could not be created");
const sha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
await writeFile(path.join(output, `${archiveName}.sha256`), `${sha256}  ${archiveName}\n`);
await writeFile(path.join(output, "BUILD_MANIFEST.json"), `${JSON.stringify({ ...manifest, files: undefined, archiveName, sha256 }, null, 2)}\n`);
console.log(`Windows release candidate: ${archiveName}\nSHA-256: ${sha256}\nStatus: NO-GO corporativo / GMP`);
