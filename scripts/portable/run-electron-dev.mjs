import { spawn } from "node:child_process";
import path from "node:path";
import electronPath from "electron";
import { stageApp, staging } from "./stage-app.mjs";

const build = spawn(process.execPath, [path.join(process.cwd(), "node_modules/next/dist/bin/next"), "build"], { stdio: "inherit" });
if (await new Promise((resolve) => build.once("exit", resolve)) !== 0) throw new Error("Next.js build failed");
await stageApp();
const desktop = spawn(electronPath, [staging], { stdio: "inherit" });
process.exitCode = await new Promise((resolve) => desktop.once("exit", (code) => resolve(code ?? 1)));
