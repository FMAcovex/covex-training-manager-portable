import assert from "node:assert/strict";
import { mkdtemp, cp, mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { stageApp, staging } from "../../scripts/portable/stage-app.mjs";
import { runInteractiveDemoFlow, assertDemoReset, demoJson } from "./interactive-demo-flow.mjs";
const { EmbeddedServer, checkPort } = createRequire(import.meta.url)("../../portable/electron/server-process.cjs");
const origin = "http://127.0.0.1:43110";
const output = path.resolve("tmp/demo-smoke");
await mkdir(output, { recursive: true });
await stageApp();
const temporary = await mkdtemp(path.join(os.tmpdir(), "covex-demo-interactiva-á-"));
const directory = path.join(temporary, "application");
await cp(staging, directory, { recursive: true });
const server = new EmbeddedServer({ executable: process.execPath, entry: path.join(directory, "server-entry.cjs"), runtime: path.join(directory, "runtime/server.js") });
let browser; let page;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PORTABLE_TEST_CHROMIUM ? { executablePath: process.env.PORTABLE_TEST_CHROMIUM } : {}), args: ["--no-sandbox"] });
  const external = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== origin) { external.push(url.origin); await route.abort(); } else await route.continue();
  });
  async function start() {
    await server.start("demo", null);
    await context.addCookies([{ name: "covex_desktop_instance", value: server.identity.token, url: origin, httpOnly: true, sameSite: "Strict" }]);
    page = await context.newPage();
    await page.goto(origin);
  }
  await start();
  const state = await runInteractiveDemoFlow(page, origin, async (view) => {
    const download = view.waitForEvent("download");
    await view.getByRole("button", { name: "Generar Anexo III", exact: true }).click();
    const result = await download;
    assert.match(result.suggestedFilename(), /\.pdf$/i);
    const file = path.join(output, "anexo-iii-ficticio.pdf");
    await result.saveAs(file);
    return { bytes: await readFile(file), filename: result.suggestedFilename() };
  });
  for (const [method, url] of [["POST", "/api/admin/training-import"], ["POST", "/api/admin/trainer-import"], ["POST", "/api/trainers/documents"], ["POST", `/api/sessions/${state.session.id}/document-control/attachments`], ["PATCH", `/api/sessions/${state.session.id}/document-control`], ["POST", "/api/portable/session"], ["DELETE", `/api/people/${state.person.id}`], ["POST", `/api/trainings/${state.training.id}/closure`]]) assert.equal((await demoJson(page, url, method, {})).status, 403, `${method} ${url}`);
  assert.equal((await demoJson(page, "/api/portable/config")).status, 403);
  await page.screenshot({ path: path.join(output, "interactive-demo.png"), fullPage: true });
  await page.goto(`${origin}/administracion/importar-formaciones`);
  await page.waitForFunction(() => document.querySelector('input[type="file"]')?.disabled);
  await page.close(); await server.stop(); await checkPort();
  await start(); await assertDemoReset(page, state);
  assert.deepEqual(external, [], "Demo must not attempt browser connections outside its own loopback server");
  await assert.rejects(access(path.join(directory, "runtime/.data")), { code: "ENOENT" });
  await writeFile(path.join(output, "result.json"), JSON.stringify({ result: "passed", mode: "desktop demo", execution: "standalone outside checkout + real UI", flow: ["validation", "person-create", "training-create-edit", "qualified-trainer", "session-create-edit", "attendee-edit", "duplicate-denied", "results-fail-absence", "reopen-correct-results", "actual-annex-iii-download", "reload-keeps-RAM", "restart-restores-seed", "no-data-directory", "forbidden-operations-403", "file-picker-disabled", "no-external-browser-requests"], pdfBytes: state.pdfBytes, realCorporateValidation: false, gmp: "NO-GO" }, null, 2));
  console.log("Interactive desktop demo passed: existing UI, real PDF download, RAM reset and isolation.");
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally { if (browser) await browser.close(); await server.stop(); await checkPort(); await rm(temporary, { recursive: true, force: true }); }
