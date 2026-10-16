const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { validateSettings, loadSettings, saveSettings, serverEnvironment, allowedNavigation, allowedRequest, readinessProof, verifyReadiness, REDIRECT_URI } = require("../../portable/electron/settings.cjs");
const { EmbeddedServer, checkPort } = require("../../portable/electron/server-process.cjs");
const config = { schemaVersion: 1, tenantId: "11111111-1111-4111-8111-111111111111", clientId: "22222222-2222-4222-8222-222222222222", siteId: "synthetic.sharepoint.com,33333333-3333-4333-8333-333333333333,44444444-4444-4444-8444-444444444444", listPrefix: "COVEX", driveId: "b!synthetic-drive-000000000", redirectUri: REDIRECT_URI };

test("public configuration roundtrip in spaces / Unicode profile, with strict rejection of secrets", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "covex perfil á 演示 "));
  try {
    assert.equal(await loadSettings(directory), null);
    await saveSettings(directory, config);
    assert.deepEqual(await loadSettings(directory), config);
    for (const key of ["accessToken", "clientSecret", "password", "mode", "noGo", "runtimePath"]) assert.throws(() => validateSettings({ ...config, [key]: "forbidden" }));
    assert.throws(() => validateSettings({ ...config, redirectUri: "http://127.0.0.1:43111/acceso-denegado" }));
    assert.throws(() => validateSettings({ ...config, siteId: "https://attacker.invalid/" }));
    assert.throws(() => validateSettings({ ...config, driveId: "secret?token=forbidden" }));
    assert.throws(() => validateSettings({ ...config, schemaVersion: 2 }));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("demo environment cannot inherit corporate credentials, Node preloads or persistence", () => {
  const inherited = { PATH: "safe", SystemRoot: "safe", HTTPS_PROXY: "safe-proxy", NODE_EXTRA_CA_CERTS: "safe-ca", NODE_OPTIONS: "--require forbidden", DATABASE_URL: "forbidden", PORTABLE_ENTRA_CLIENT_ID: "forbidden", GH_TOKEN: "forbidden", AUTH_PROXY_SECRET: "forbidden", DEMO_DATA_DIR: "forbidden" };
  const identity = { id: "a".repeat(48), token: "b".repeat(64) };
  const demo = serverEnvironment("demo", config, identity, inherited);
  assert.equal(demo.PERSISTENCE_PROVIDER, "demo"); assert.equal(demo.AUTH_MODE, "demo"); assert.equal(demo.DATABASE_URL, "");
  assert.equal(demo.HTTPS_PROXY, "safe-proxy"); assert.equal(demo.NODE_EXTRA_CA_CERTS, "safe-ca");
  for (const key of ["GH_TOKEN", "NODE_OPTIONS", "AUTH_PROXY_SECRET", "DEMO_DATA_DIR", "PORTABLE_ENTRA_CLIENT_ID"]) assert.equal(demo[key], undefined);
  const corporate = serverEnvironment("corporate", config, identity, inherited);
  assert.equal(corporate.AUTH_MODE, "portable-entra"); assert.equal(corporate.PERSISTENCE_PROVIDER, "portable-sharepoint"); assert.equal(corporate.APP_ENV, "production");
  assert.equal(corporate.PORTABLE_ENTRA_CLIENT_ID, config.clientId);
  assert.throws(() => serverEnvironment("invalid", config, identity));
});

test("navigation admits loopback and HTTPS OAuth destinations only", () => {
  assert.equal(allowedNavigation("http://127.0.0.1:43110/formaciones"), true);
  for (const value of ["file:///etc/passwd", "javascript://login.microsoft.com/alert(1)", "http://login.microsoftonline.com/", "https://login.microsoft.com.attacker.invalid/", "http://localhost:43110/", "http://127.0.0.1:43111/"]) assert.equal(allowedNavigation(value, true), false);
  assert.equal(allowedNavigation("https://login.microsoftonline.com/tenant/oauth2", true), true);
  assert.equal(allowedNavigation("https://login.microsoftonline.com/tenant/oauth2", false), false);
  assert.equal(allowedNavigation("https://login.microsoftonline.com:444/tenant/oauth2", true), false);
  assert.equal(allowedNavigation("https://aadcdn.msftauth.net/", true), false);
  assert.equal(allowedRequest("https://aadcdn.msftauth.net/", true), true);
  assert.equal(allowedRequest("https://aadcdn.msftauth.net/", false), false);
  assert.equal(allowedRequest("https://aadcdn.msftauth.net.attacker.invalid/", true), false);
});

test("readiness cannot be spoofed by a different instance or process", () => {
  const identity = { id: "a".repeat(48), token: "b".repeat(64) }; const challenge = "c".repeat(48);
  const result = { id: identity.id, pid: 123, mode: "demo", proof: readinessProof(identity.token, challenge, identity.id, 123, "demo") };
  assert.equal(verifyReadiness(identity, challenge, result, "demo"), true);
  assert.equal(verifyReadiness(identity, challenge, { ...result, pid: 456 }, "demo"), false);
  assert.equal(verifyReadiness(identity, "d".repeat(48), result, "demo"), false);
  assert.equal(verifyReadiness(identity, challenge, { ...result, proof: "forged" }, "demo"), false);
});

test("occupied port is rejected without connecting to or killing its owner", async () => {
  let connections = 0; const foreign = net.createServer(() => { connections += 1; });
  await new Promise((resolve) => foreign.listen(43110, "127.0.0.1", resolve));
  try { await assert.rejects(checkPort(), { code: "PORT_IN_USE" }); assert.equal(connections, 0); assert.equal(foreign.listening, true); }
  finally { await new Promise((resolve) => foreign.close(resolve)); }
});

test("embedded child starts, proves ownership and releases its port on repeated shutdown", async () => {
  const embedded = new EmbeddedServer({ executable: process.execPath, entry: path.join(__dirname, "fake-desktop-server.cjs"), runtime: path.join(__dirname, "fake-desktop-server.cjs") });
  try {
    for (let iteration = 0; iteration < 2; iteration += 1) {
      await embedded.start("demo", null);
      assert.equal((await fetch("http://127.0.0.1:43110/api/health")).status, 401);
      await embedded.stop(); await checkPort();
    }
  } finally { await embedded.stop(); }
});

test("traced pnpm dependencies are materialized without symlinks; conflicting versions fail", async () => {
  const { materializeTracedPackages, inventory, allowedRuntimeFile } = await import("../../scripts/portable/stage-app.mjs");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "covex-packaging-"));
  const modules = path.join(directory, "source"); const destination = path.join(directory, "runtime");
  try {
    for (const [store, name] of [["next@1", "next"], ["styled-jsx@1", "styled-jsx"], ["env@1", "@next/env"]]) {
      const pkg = path.join(modules, ".pnpm", store, "node_modules", name);
      await fs.mkdir(pkg, { recursive: true });
      await fs.writeFile(path.join(pkg, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
    }
    await materializeTracedPackages(modules, destination);
    assert.deepEqual((await inventory(destination)).map(({ file }) => file), ["@next/env/package.json", "next/package.json", "styled-jsx/package.json"]);
    for (const value of [".env", ".env.local", "tests", ".data", "credentials.pem", "dump.sql"]) assert.equal(allowedRuntimeFile(value), false);
    const conflict = path.join(modules, ".pnpm", "styled-jsx@2", "node_modules", "styled-jsx");
    await fs.mkdir(conflict, { recursive: true }); await fs.writeFile(path.join(conflict, "package.json"), JSON.stringify({ name: "styled-jsx", version: "2.0.0" }));
    await assert.rejects(materializeTracedPackages(modules, destination), /Conflicting traced runtime versions/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
