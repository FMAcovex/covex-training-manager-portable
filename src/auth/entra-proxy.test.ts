import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { AuthenticationError } from "./errors";
import { resolveEntraProxyPrincipal, type TokenVerifier } from "./entra-proxy";
const tenant = "11111111-1111-1111-1111-111111111111";
const audience = "22222222-2222-2222-2222-222222222222";
const oid = "33333333-3333-3333-3333-333333333333";
const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
const env = { APP_ENV: "production", AUTH_MODE: "entra-proxy", DATABASE_URL: "postgresql://test", ENTRA_TENANT_ID: tenant, ENTRA_CLIENT_ID: audience, AUTH_PROXY_SECRET: "a".repeat(64) };
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let verify: TokenVerifier;
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  const jwks = createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: "test", alg: "RS256" }] });
  verify = async (token, expectedTenant, expectedAudience) => (await jwtVerify(token, jwks, { issuer: `https://login.microsoftonline.com/${expectedTenant}/v2.0`, audience: expectedAudience, algorithms: ["RS256"], requiredClaims: ["exp", "iat", "oid", "tid"] })).payload;
});
async function token(overrides: Record<string, unknown> = {}, signingKey = keys.privateKey) {
  return new SignJWT({ oid, tid: tenant, ...overrides }).setProtectedHeader({ alg: "RS256", kid: "test" }).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime("1h").sign(signingKey);
}
async function headers(overrides: Record<string, string> = {}, jwt?: string) {
  return new Headers({ "x-covex-proxy-secret": env.AUTH_PROXY_SECRET, "x-covex-entra-token": `Bearer ${jwt ?? await token()}`, ...overrides });
}
describe("identidad Entra en servidor privado", () => {
  it("obtiene oid de un JWT firmado y verificado; ignora cabecera App Service", async () => {
    expect(await resolveEntraProxyPrincipal(await headers({ "x-ms-client-principal-id": "forged" }), env, verify)).toBe(oid);
  });
  it.each(["", "b".repeat(64), "é".repeat(64)])("deniega secreto de proxy inválido sin filtrar valores", async supplied => {
    await expect(resolveEntraProxyPrincipal(await headers({ "x-covex-proxy-secret": supplied }), env, verify)).rejects.toBeInstanceOf(AuthenticationError);
  });
  it("no admite identidad de una cabecera sola", async () => {
    await expect(resolveEntraProxyPrincipal(new Headers({ "x-ms-client-principal-id": oid }), env, verify)).rejects.toMatchObject({ status: 401 });
  });
  it("deniega tokens ausentes y malformados", async () => {
    for (const value of ["", "Bearer fake", "Basic fake"]) await expect(resolveEntraProxyPrincipal(await headers({ "x-covex-entra-token": value }), env, verify)).rejects.toMatchObject({ status: 401 });
  });
  it.each([{ oid: "invalid" }, { tid: audience }, { aud: tenant }, { iss: "https://attacker.invalid" }, { exp: 1 }])("deniega claims inválidos %j", async claims => {
    // Set registered claims after normal builder defaults to exercise issuer/audience/expiry checks.
    const jwt = await new SignJWT({ oid, tid: tenant, iss: issuer, aud: audience, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600, ...claims }).setProtectedHeader({ alg: "RS256", kid: "test" }).sign(keys.privateKey);
    await expect(resolveEntraProxyPrincipal(await headers({}, jwt), env, verify)).rejects.toMatchObject({ status: 401 });
  });
  it("deniega firma no válida y no revela errores del proveedor", async () => {
    const other = await generateKeyPair("RS256");
    await expect(resolveEntraProxyPrincipal(await headers({}, await token({}, other.privateKey)), env, verify)).rejects.toThrow("Identidad corporativa no disponible o inválida");
  });
});
