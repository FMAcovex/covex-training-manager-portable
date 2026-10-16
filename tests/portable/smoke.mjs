import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd(); const port = 43119; const origin = `http://127.0.0.1:${port}`;
const tenant = "11111111-1111-4111-8111-111111111111"; const client = "22222222-2222-4222-8222-222222222222"; const oid = "33333333-3333-4333-8333-333333333333";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "synthetic-only", use: "sig", alg: "RS256" };
const now = Math.floor(Date.now() / 1000);
function token(audience) {
  const body = `${Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid })).toString("base64url")}.${Buffer.from(JSON.stringify({ iss: `https://login.microsoftonline.com/${tenant}/v2.0`, aud: audience, tid: tenant, oid, iat: now, exp: now + 3600 })).toString("base64url")}`;
  return `${body}.${sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")}`;
}
const output = path.join(root, "tmp/portable-smoke"); await mkdir(output, { recursive: true });
let logs = ""; let browser; let server;
try {
  server = spawn(process.execPath, ["--import", fileURLToPath(new URL("./graph-simulator.mjs", import.meta.url)), path.join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: {
      ...process.env, NODE_ENV: "production", APP_ENV: "production", AUTH_MODE: "portable-entra", PERSISTENCE_PROVIDER: "portable-sharepoint", DATABASE_URL: "",
      PORTABLE_ENTRA_TENANT_ID: tenant, PORTABLE_ENTRA_CLIENT_ID: client, PORTABLE_ENTRA_REDIRECT_URI: `${origin}/acceso-denegado`,
      PORTABLE_SHAREPOINT_SITE_ID: "synthetic-site", PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID: "synthetic-drive", PORTABLE_SHAREPOINT_LIST_PREFIX: "COVEX",
      COVEX_TEST_JWKS: JSON.stringify({ keys: [jwk] }), COVEX_TEST_OBJECT_ID: oid,
    }, stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => { logs += chunk; }); server.stderr.on("data", (chunk) => { logs += chunk; });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next exited: ${server.exitCode}`);
    try { if ((await fetch(`${origin}/api/health`)).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, "Portable server must start without PostgreSQL");
  const browserExecutable = process.env.PORTABLE_TEST_CHROMIUM;
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}), args: ["--no-sandbox"] });
  const context = await browser.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin }, viewport: { width: 1440, height: 1000 } });
  const api = context.request;
  assert.equal((await api.get("/api/people")).status(), 401, "Anonymous backend request");
  const session = await api.post("/api/portable/session", { data: { accessToken: token("https://graph.microsoft.com"), idToken: token(client) } });
  assert.equal(session.status(), 200, await session.text());
  const legacy = await api.get("/api/portable/trainings", { headers: { Authorization: `Bearer ${token(client)}` } });
  assert.equal(legacy.status(), 410, "Legacy bearer-only POC must be closed");
  const page = await context.newPage(); const clientErrors = [];
  page.on("pageerror", (error) => clientErrors.push(error.message));
  await page.goto("/personal");
  await page.locator('[name="fullName"]').fill("Persona sintética UI");
  await page.locator('[name="employeeCode"]').fill("SYN-UI-001");
  await page.locator('[name="departmentId"]').selectOption("quality");
  await page.locator('[name="jobTitle"]').fill("Técnico sintético");
  const personSaved = page.waitForResponse((response) => response.url().endsWith("/api/people") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Añadir persona", exact: true }).click();
  const personResponse = await personSaved; assert.equal(personResponse.status(), 201, await personResponse.text());
  const person = await personResponse.json();
  await page.goto("/formaciones/nueva");
  await page.locator('[name="name"]').fill("Formación sintética UI");
  await page.locator('[name="planningType"]').selectOption("PLANNED");
  await page.locator('[name="trainingTypeId"]').selectOption("type");
  await page.locator('[name="originType"]').selectOption("EXTERNAL");
  await page.locator('[name="externalTrainerNames"]').fill("Entidad sintética");
  await page.locator('[name="modalityId"]').selectOption("onsite");
  for (const [name, value] of Object.entries({ plannedDurationMinutes: "60", materialReference: "SYN-DOC-1", content: "Contenido sintético", targetGroup: "Grupo sintético", aptitudeCriterion: "Superar test sintético" })) await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="evaluationMethodId"]').selectOption("test");
  const trainingSaved = page.waitForResponse((response) => response.url().endsWith("/api/trainings") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Crear formación", exact: true }).click();
  const trainingResponse = await trainingSaved; assert.equal(trainingResponse.status(), 201, await trainingResponse.text());
  const training = await trainingResponse.json();
  await page.waitForURL(`**/formaciones/${training.id}`);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.locator('[name="name"]').fill("Formación sintética UI revisada");
  const editSaved = page.waitForResponse((response) => response.url().endsWith(`/api/trainings/${training.id}`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  const editResponse = await editSaved; assert.equal(editResponse.status(), 200, await editResponse.text());
  const sessionCreated = await api.post(`/api/trainings/${training.id}/sessions`, { data: { trainingId: training.id, plannedDate: "2026-12-01", externalTrainerNames: ["Entidad sintética"], durationMinutes: 60, attendeePersonIds: [person.id], blankAttendanceRows: 2 } });
  assert.equal(sessionCreated.status(), 201, await sessionCreated.text()); const trainingSession = await sessionCreated.json();
  const finalized = await api.post(`/api/sessions/${trainingSession.id}/finalize`, { data: { executionDate: "2026-12-01", initializeDefaults: true, attendances: [] } });
  assert.equal(finalized.status(), 200, await finalized.text());
  await page.goto(`/sesiones/${trainingSession.id}`);
  const uploadResponse = page.waitForResponse((response) => response.url().endsWith("/attachments") && response.request().method() === "POST");
  const content = Buffer.from("Evidencia sintética portable H10B\n");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "synthetic.txt", mimeType: "text/plain", buffer: content });
  const attachmentResponse = await uploadResponse; assert.equal(attachmentResponse.status(), 201, await attachmentResponse.text()); const attachment = await attachmentResponse.json();
  const downloaded = await api.get(`/api/sessions/${trainingSession.id}/document-control/attachments/${attachment.id}`);
  assert.equal(downloaded.status(), 200); assert.deepEqual(await downloaded.body(), content);
  for (const suffix of [`/api/sessions/${trainingSession.id}/annex-iii`, "/api/annual-plan/2026/annex-iv", `/api/people/${person.id}/annex-v?year=2026`]) {
    const response = await api.post(suffix); assert.equal(response.status(), 200, await response.text()); assert((await response.body()).subarray(0, 4).equals(Buffer.from("%PDF")));
  }
  await page.screenshot({ path: path.join(output, "session-synthetic.png"), fullPage: true });
  await page.goto("/administracion/revision-datos");
  await page.getByRole("heading", { name: /Revisión/ }).first().waitFor();
  assert.deepEqual(clientErrors, [], "Browser must not have uncaught JavaScript errors");
  assert.equal((await api.delete("/api/portable/session")).status(), 200);
  assert.equal((await api.get("/api/people")).status(), 401, "Logout must revoke the server session");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ result: "passed", provider: "portable-sharepoint", authentication: "signed synthetic Entra identity + simulated Graph", postgres: false, ui: ["person-create", "training-create", "training-update", "document-upload", "integrity-page"], api: ["session-create", "session-finalize", "document-download", "annex-iii", "annex-iv", "annex-v", "anonymous-denied", "legacy-poc-disabled", "logout"], sha256: createHash("sha256").update(content).digest("hex") }, null, 2));
  console.log("Portable UI smoke passed; synthetic evidence in tmp/portable-smoke.");
} catch (error) {
  await writeFile(path.join(output, "server.log"), logs);
  throw error;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill();
}
