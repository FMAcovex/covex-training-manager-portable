import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, open, readFile, writeFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright-core";

// This suite runs the extracted, packaged EXE, NOT next dev or npm's Electron.
assert.equal(process.platform, "win32", "Native acceptance must run on Windows");
const origin = "http://127.0.0.1:43110";
const output = path.resolve("tmp/desktop-smoke");
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(path.join(os.tmpdir(), "covex-native-"));
const extracted = path.join(temporary, "COVEX prueba á 演示");
const manifest = JSON.parse(await readFile("dist-portable/BUILD_MANIFEST.json", "utf8"));
const archive = path.resolve("dist-portable", manifest.archiveName);
const sha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
assert.equal(sha256, manifest.sha256, "ZIP hash must match release manifest");
assert.equal((await readFile(`${archive}.sha256`, "utf8")).split(" ")[0], sha256);
execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Expand-Archive -LiteralPath $env:COVEX_TEST_ARCHIVE -DestinationPath $env:COVEX_TEST_EXTRACT"], { env: { ...process.env, COVEX_TEST_ARCHIVE: archive, COVEX_TEST_EXTRACT: extracted } });
const directory = path.join(extracted, "COVEX Training Manager Portable-win32-x64");
const executable = path.join(directory, "COVEX Training Manager Portable.exe");
const packaged = JSON.parse(await readFile(path.join(directory, "BUILD_MANIFEST.json"), "utf8"));
for (const required of ["COVEX Training Manager Portable.exe", "README_INICIO_WINDOWS.md", "resources/app/runtime/server.js", "resources/app/preload.cjs"]) assert(packaged.files.some(({ file }) => file === required), `Missing ${required}`);
assert(packaged.files.some(({ file }) => file.startsWith("resources/app/runtime/.next/static/")), "Static resources must be packaged");
assert(!packaged.files.some(({ file }) => /(^|\/)(tests|__tests__|\.data|\.env[^/]*)(\/|$)/.test(file)), "No operational test fixtures or local data in distribution");
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const user = execFileSync("whoami.exe", { encoding: "utf8" }).trim();
let native; let foreign; let acl = false; let launcher; let view;
const passed = [];
async function until(check, message, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await check()) return; await new Promise((resolve) => setTimeout(resolve, 200)); }
  throw new Error(message);
}
function record(name) { passed.push(name); console.log(`Native Windows passed: ${name}`); }
async function portFree() {
  return new Promise((resolve) => { const probe = net.createServer(); probe.once("error", () => resolve(false)); probe.listen({ host: "127.0.0.1", port: 43110, exclusive: true }, () => probe.close(() => resolve(true))); });
}
async function waitIdle() { await until(async () => (await launcher.locator("#status-panel").getAttribute("aria-busy")) === "false", "Launcher must become idle"); }
async function openDemo(button = "#start-demo") {
  const created = native.waitForEvent("window", { timeout: 90_000 });
  await launcher.locator(button).click();
  view = await created;
  await view.waitForLoadState("domcontentloaded");
  await view.locator(".portable-notice").waitFor();
  assert.match(await view.locator(".portable-notice").innerText(), /DEMO — DATOS FICTICIOS/);
  assert.equal(await view.evaluate(() => typeof window.covexDesktop), "undefined", "App renderer must never receive privileged desktop bridge");
  assert.equal(await view.evaluate(() => typeof window.require), "undefined", "Renderer must not have Node");
  await waitIdle();
}
async function closeView() {
  await view.close(); view = null;
  await launcher.waitForLoadState();
  await until(async () => (await launcher.locator("#status-message").innerText()).startsWith("Servicio cerrado."), "Closing application must return to configuration");
  await until(portFree, "Own child must exit and release port");
}
async function localRequest(url, method = "GET") {
  return view.evaluate(async ({ url, method }) => {
    const response = await fetch(url, { method });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, contentType: response.headers.get("Content-Type"), prefix: Array.from(bytes.slice(0, 4)) };
  }, { url, method });
}
try {
  assert(await portFree(), "Runner must begin with free fixed port");
  // Generic W also denies SYNCHRONIZE / READ_CONTROL on NTFS, unintentionally
  // blocking reads and EXE launch. Deny only write/delete bits, retaining RX.
  execFileSync("icacls.exe", [directory, "/deny", `${user}:(OI)(CI)(WD,AD,WEA,WA,DE,DC)`, "/T", "/C"], { stdio: "ignore" }); acl = true;
  await assert.rejects(writeFile(path.join(directory, "must-not-write.tmp"), "test"), (error) => ["EACCES", "EPERM"].includes(error.code), "Read-only install ACL must actually deny writing");
  await (await open(executable, "r")).close();
  native = await electron.launch({ executablePath: executable, args: [], env, timeout: 60_000 });
  launcher = await native.firstWindow();
  await launcher.locator("#version").filter({ hasText: manifest.version }).waitFor();
  record("extracted-exe-unicode-spaces-read-only-install");
  assert.equal(await launcher.evaluate(() => typeof window.require), "undefined");
  const preferences = await native.evaluate(({ BrowserWindow }) => {
    const { sandbox, contextIsolation, nodeIntegration } = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { sandbox, contextIsolation, nodeIntegration };
  });
  assert.equal(preferences.sandbox, true); assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false);
  record("sandbox-isolation-no-renderer-node");

  let foreignConnections = 0;
  foreign = net.createServer((socket) => { foreignConnections += 1; socket.end(); });
  await new Promise((resolve, reject) => { foreign.once("error", reject); foreign.listen(43110, "127.0.0.1", resolve); });
  await launcher.locator("#start-demo").click();
  await until(async () => (await launcher.locator("#status-code").innerText()).includes("PORT_IN_USE"), "Occupied port must show actionable error");
  assert.equal(foreignConnections, 0, "No connection or secret sent to foreign service");
  assert(foreign.listening, "Foreign service must not be killed");
  await new Promise((resolve) => foreign.close(resolve)); foreign = null;
  record("occupied-port-no-contact-no-kill");
  await openDemo("#retry");
  const readiness = await fetch(`${origin}/api/portable/desktop-ready`, { headers: { "x-covex-challenge": "a".repeat(48) } });
  assert.equal(readiness.status, 200); const identity = await readiness.json();
  assert.equal(identity.mode, "demo"); assert(identity.pid > 0);
  assert.equal((await fetch(`${origin}/api/health`)).status, 401, "External browser cannot access local application APIs");
  assert.equal((await localRequest("/api/health")).status, 200);
  assert.equal((await localRequest("/api/people")).status, 200);
  for (const route of ["/api/people", "/api/admin/training-import", "/api/admin/trainer-import", "/api/trainers/documents", "/api/sessions/session-demo-1/document-control/attachments"]) assert.equal((await localRequest(route, "POST")).status, 403, `Demo must refuse ${route}`);
  assert.equal((await localRequest("/api/portable/config")).status, 403);
  assert.equal((await localRequest("/api/portable/session", "POST")).status, 403);
  for (const route of ["/api/sessions/session-demo-1/annex-iii", "/api/annual-plan/2026/annex-iv", "/api/people/demo-1/annex-v?year=2026"]) {
    const response = await localRequest(route, "POST");
    assert.equal(response.status, 200, `Synthetic annex must work: ${route}`); assert.equal(response.contentType, "application/pdf"); assert.deepEqual(response.prefix, [37, 80, 68, 70]);
  }
  assert.equal((await localRequest("/api/trainers/export")).status, 200, "Qualified trainers document remains available");
  for (const route of ["/formaciones", "/sesiones/session-demo-1", "/formadores", "/personal", "/plan-anual", "/documentacion", "/administracion/revision-datos"]) {
    const response = await view.goto(`${origin}${route}`); assert.equal(response.status(), 200, `Existing module ${route}`);
    assert.match(await view.locator(".portable-notice").innerText(), /DEMO — DATOS FICTICIOS/);
  }
  await view.goto(`${origin}/administracion/importar-formaciones`);
  await until(async () => view.locator('input[type="file"]').first().isDisabled(), "Demo file selection must be disabled as well as rejected by server");
  await view.screenshot({ path: path.join(output, "demo-windows-synthetic.png"), fullPage: true });
  record("demo-health-modules-annexes-readonly-no-corporate-endpoints");
  const duplicate = spawn(executable, [], { env, stdio: "ignore", windowsHide: true });
  const duplicateCode = await new Promise((resolve, reject) => { const timer = setTimeout(() => { duplicate.kill(); reject(new Error("Duplicate instance did not exit")); }, 15_000); duplicate.once("exit", (code) => { clearTimeout(timer); resolve(code); }); duplicate.once("error", reject); });
  assert.equal(duplicateCode, 0); assert.equal((await localRequest("/api/health")).status, 200);
  record("single-instance-existing-process-preserved");
  await closeView(); record("clean-close-and-port-release");
  await openDemo(); await closeView(); record("repeat-start-close");

  const config = { schemaVersion: 1, tenantId: "11111111-1111-4111-8111-111111111111", clientId: "22222222-2222-4222-8222-222222222222", siteId: "synthetic.sharepoint.com,33333333-3333-4333-8333-333333333333,44444444-4444-4444-8444-444444444444", listPrefix: "COVEX_SYNTHETIC", driveId: "b!synthetic-drive-only", redirectUri: `${origin}/acceso-denegado` };
  for (const [name, value] of Object.entries(config)) if (name !== "schemaVersion" && name !== "redirectUri") await launcher.locator(`#${name}`).fill(value);
  await launcher.locator("#save").click(); await waitIdle();
  await until(async () => (await launcher.locator("#status-message").innerText()).startsWith("Configuración pública guardada"), "Public wizard configuration must save");
  const userData = await native.evaluate(({ app }) => app.getPath("userData"));
  assert(!userData.startsWith(directory), "Configuration cannot be written inside install folder");
  assert.deepEqual(JSON.parse(await readFile(path.join(userData, "microsoft365.public.json"), "utf8")), config);
  const publicExport = path.join(temporary, "config-publica.json");
  await native.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, publicExport);
  await launcher.locator("#export").click(); await waitIdle();
  assert.deepEqual(JSON.parse(await readFile(publicExport, "utf8")), config);
  const badImport = path.join(temporary, "invalid-public-config.json");
  await writeFile(badImport, JSON.stringify({ ...config, clientSecret: "synthetic-rejected-field" }));
  await native.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, badImport);
  await launcher.locator("#import").click(); await waitIdle();
  assert.match(await launcher.locator("#status-code").innerText(), /CONFIG_INVALID/);
  assert.deepEqual(JSON.parse(await readFile(path.join(userData, "microsoft365.public.json"), "utf8")), config, "Rejected import must not alter saved public configuration");
  await native.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, publicExport);
  await launcher.locator("#import").click(); await waitIdle();
  assert.match(await launcher.locator("#status-message").innerText(), /Configuración pública importada/);
  record("visual-wizard-save-import-export-secret-rejection-user-profile");
  await launcher.locator("#copy-diagnostic").click();
  const diagnostic = JSON.parse(await native.evaluate(({ clipboard }) => clipboard.readText()));
  assert.equal(diagnostic.candidate, "NO-GO corporativo / GMP");
  const serialized = JSON.stringify(diagnostic);
  for (const excluded of [config.tenantId, config.siteId, userData, identity.id, identity.proof, "synthetic-rejected-field"]) assert(!serialized.includes(excluded), "Diagnostic must be redacted");
  const diagnosticFile = path.join(temporary, "diagnostic.json");
  await native.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, diagnosticFile);
  await launcher.locator("#export-diagnostic").click(); await waitIdle();
  assert.equal(JSON.parse(await readFile(diagnosticFile, "utf8")).configurationPresent, true);
  await launcher.screenshot({ path: path.join(output, "launcher-windows-synthetic.png"), fullPage: true });
  record("redacted-diagnostic-copy-export");

  await launcher.locator("#acknowledge").check();
  const corporateWindow = native.waitForEvent("window", { timeout: 90_000 });
  await launcher.locator("#start-corporate").click(); view = await corporateWindow;
  await view.getByRole("button", { name: "Iniciar sesión con Microsoft Entra" }).waitFor();
  assert.match(await view.locator(".portable-notice").innerText(), /NO-GO/);
  const publicConfiguration = await view.evaluate(async () => (await fetch("/api/portable/config")).json());
  assert.equal(publicConfiguration.tenantId, config.tenantId); assert.equal(publicConfiguration.clientId, config.clientId); assert.equal(publicConfiguration.redirectUri, config.redirectUri);
  assert.equal((await localRequest("/api/people")).status, 401, "Corporate data requires signed Entra identity, never demo fallback");
  await waitIdle();
  record("standalone-configuration-msal-corporate-auth-no-demo-fallback");
  const popupCreated = native.waitForEvent("window");
  await view.evaluate(() => { window.open("about:blank", "covex-synthetic-auth"); });
  const popup = await popupCreated;
  assert.equal(await popup.evaluate(() => typeof window.covexDesktop), "undefined");
  // Kill only the verified child created by this test, then verify actionable recovery.
  const corporateIdentity = await (await fetch(`${origin}/api/portable/desktop-ready`, { headers: { "x-covex-challenge": "b".repeat(48) } })).json();
  process.kill(corporateIdentity.pid);
  await until(async () => (await launcher.locator("#status-code").innerText()).includes("SERVER_EXIT"), "Unexpected owned-child exit must be visible");
  await until(portFree, "Crashed own child must release port"); view = null;
  assert(popup.isClosed(), "OAuth popup must close and lose its session when owned server exits");
  await openDemo(); record("unexpected-child-exit-visible-and-recoverable");
  await native.close(); native = null; view = null;
  await until(portFree, "Quitting launcher must close own child and release port");
  record("whole-application-exit-no-orphan-service");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ result: "passed", platform: process.platform, os: os.release(), architecture: process.arch, version: manifest.version, sourceCommit: manifest.sourceCommit, archiveName: manifest.archiveName, sha256, execution: "extracted packaged Windows EXE with embedded Node/Next", passed, realCorporateValidation: false, gmp: "NO-GO", pending: ["physical Windows 10/11", "standard-user corporate desktop", "corporate AV / SmartScreen / signature", "real Entra / SharePoint / permissions / audit / recovery"] }, null, 2));
} catch (error) {
  console.error(`Native smoke failed after: ${passed.join(", ") || "EXE launch"}`);
  if (launcher && !launcher.isClosed()) await launcher.screenshot({ path: path.join(output, "failure-launcher.png"), fullPage: true }).catch(() => {});
  await writeFile(path.join(output, "failure.json"), JSON.stringify({ passed, error: error instanceof Error ? error.message : "Native smoke failure", realCorporateValidation: false }, null, 2));
  throw error;
} finally {
  if (native) await native.close().catch(() => {});
  if (foreign) await new Promise((resolve) => foreign.close(resolve));
  if (acl) execFileSync("icacls.exe", [directory, "/remove:d", user, "/T", "/C"], { stdio: "ignore" });
  await rm(temporary, { recursive: true, force: true });
}
