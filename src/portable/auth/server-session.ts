import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { AuthenticationError } from "@/auth/errors";
import { readPortablePublicConfiguration } from "@/portable/config";
import { GraphClient } from "@/portable/graph/graph-client";

export const PORTABLE_SESSION_COOKIE = "covex_portable_session";
const MAX_SESSIONS = 128;
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export const portableSessionInputSchema = z.object({
  accessToken: z.string().min(100).max(32768),
  idToken: z.string().min(100).max(32768),
});

export type PortableSession = {
  id: string;
  accessToken: string;
  entraObjectId: string;
  tenantId: string;
  displayName: string;
  email?: string;
  expiresAt: number;
};

type MeResponse = { id?: string; displayName?: string; mail?: string; userPrincipalName?: string };
type IdTokenVerifier = (token: string, tenantId: string, clientId: string) => Promise<JWTPayload>;

const sessions = new Map<string, PortableSession>();
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const verifyIdToken: IdTokenVerifier = async (token, tenantId, clientId) => {
  let keys = keySets.get(tenantId);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`), { timeoutDuration: 5000 });
    keySets.set(tenantId, keys);
  }
  const { payload } = await jwtVerify(token, keys, {
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    audience: clientId,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "tid", "oid"],
  });
  return payload;
};

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function pruneSessions(now = Date.now()) {
  for (const [id, session] of sessions) if (session.expiresAt <= now) sessions.delete(id);
  while (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
}

export async function createPortableSession(
  input: z.infer<typeof portableSessionInputSchema>,
  options: { verify?: IdTokenVerifier; graph?: GraphClient; now?: number } = {},
): Promise<PortableSession> {
  const config = readPortablePublicConfiguration();
  const now = options.now ?? Date.now();
  try {
    const claims = await (options.verify ?? verifyIdToken)(input.idToken, config.tenantId, config.clientId);
    if (claims.tid !== config.tenantId || !validUuid(claims.oid)) throw new Error("claims");
    const graph = options.graph ?? new GraphClient(input.accessToken);
    const me = await graph.requestJson<MeResponse>("/me?$select=id,displayName,mail,userPrincipalName");
    if (!me.id || me.id.toLocaleLowerCase() !== claims.oid.toLocaleLowerCase()) throw new Error("identity");
    let accessExpiry = now + 60 * 60 * 1000;
    try {
      const decoded = decodeJwt(input.accessToken);
      if (typeof decoded.exp === "number") accessExpiry = decoded.exp * 1000;
    } catch {
      // Graph accepted the access token; use the conservative one-hour fallback.
    }
    const idExpiry = typeof claims.exp === "number" ? claims.exp * 1000 : now;
    const expiresAt = Math.min(accessExpiry, idExpiry, now + SESSION_MAX_AGE_MS);
    if (expiresAt <= now + 30_000) throw new Error("expired");
    pruneSessions(now);
    const session: PortableSession = {
      id: randomBytes(32).toString("base64url"),
      accessToken: input.accessToken,
      entraObjectId: claims.oid,
      tenantId: config.tenantId,
      displayName: me.displayName?.trim() || "Usuario COVEX",
      email: me.mail?.trim() || me.userPrincipalName?.trim() || undefined,
      expiresAt,
    };
    sessions.set(session.id, session);
    return session;
  } catch {
    throw new AuthenticationError("La identidad Microsoft Entra o el token delegado no son válidos", 401);
  }
}

export function findPortableSession(id: string | undefined, now = Date.now()) {
  if (!id) return undefined;
  const session = sessions.get(id);
  if (!session || session.expiresAt <= now) {
    sessions.delete(id);
    return undefined;
  }
  return session;
}

export function removePortableSession(id: string | undefined) {
  if (id) sessions.delete(id);
}

export async function getPortableSession() {
  const cookieStore = await cookies();
  return findPortableSession(cookieStore.get(PORTABLE_SESSION_COOKIE)?.value);
}

export async function requirePortableSession() {
  const session = await getPortableSession();
  if (!session) throw new AuthenticationError("Inicia sesión con Microsoft Entra para continuar", 401);
  return session;
}

export async function portableAccessToken() {
  return (await requirePortableSession()).accessToken;
}

export function clearPortableSessionsForTests() {
  sessions.clear();
}
