import assert from "node:assert/strict";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { stageApp, staging } from "../../scripts/portable/stage-app.mjs";
const require = createRequire(import.meta.url);
const { EmbeddedServer, checkPort } = require("../../portable/electron/server-process.cjs");
await stageApp();
// Outside the checkout: missing dependencies must NOT fall back to dev node_modules.
const directory = await mkdtemp(path.join(os.tmpdir(), "covex standalone á "));
await cp(staging, directory, { recursive: true });
const server = new EmbeddedServer({ executable: process.execPath, entry: path.join(directory, "server-entry.cjs"), runtime: path.join(directory, "runtime/server.js") });
const origin = "http://127.0.0.1:43110";
try {
  await server.start("demo", null);
  const headers = { Cookie: `covex_desktop_instance=${server.identity.token}`, Origin: origin };
  assert.equal((await fetch(`${origin}/api/health`)).status, 401);
  for (const route of ["/api/health", "/api/people", "/", "/formadores"]) assert.equal((await fetch(`${origin}${route}`, { headers })).status, 200, route);
  for (const route of ["/api/admin/users", "/api/admin/training-import", "/api/sessions/session-demo-1/document-control/attachments", "/api/portable/session"]) assert.equal((await fetch(`${origin}${route}`, { method: "POST", headers })).status, 403, route);
  for (const route of ["/api/sessions/session-demo-1/annex-iii", "/api/annual-plan/2026/annex-iv", "/api/people/demo-1/annex-v?year=2026"]) {
    const response = await fetch(`${origin}${route}`, { method: "POST", headers });
    assert.equal(response.status, 200, route); assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
  }
  await server.stop(); await checkPort();
  const config = { schemaVersion: 1, tenantId: "11111111-1111-4111-8111-111111111111", clientId: "22222222-2222-4222-8222-222222222222", siteId: "synthetic.sharepoint.com,33333333-3333-4333-8333-333333333333,44444444-4444-4444-8444-444444444444", listPrefix: "COVEX_SYNTHETIC", driveId: "b!synthetic-drive-only", redirectUri: `${origin}/acceso-denegado` };
  await server.start("corporate", config);
  const corporateHeaders = { Cookie: `covex_desktop_instance=${server.identity.token}` };
  assert.equal((await fetch(`${origin}/api/people`, { headers: corporateHeaders })).status, 401);
  assert.equal((await (await fetch(`${origin}/api/portable/config`, { headers: corporateHeaders })).json()).clientId, config.clientId);
  const login = await fetch(origin, { headers: corporateHeaders });
  assert.equal(login.status, 200); assert.match(await login.text(), /Iniciar sesión con Microsoft Entra/);
  console.log("Standalone outside checkout passed: embedded runtime, demo isolation, annexes, corporate public configuration, Entra required, shutdown.");
} finally { await server.stop(); await checkPort(); await rm(directory, { recursive: true, force: true }); }
