import { timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { readRuntimeConfiguration } from "@/config/runtime";
import { AuthenticationError } from "@/auth/errors";

// Entra tokens are independently verified here; proxy headers alone never identify a user.
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export type TokenVerifier = (token: string, tenant: string, audience: string) => Promise<JWTPayload>;

const verifyEntraToken: TokenVerifier = async (token, tenant, audience) => {
  const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
  let keys = keySets.get(tenant);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`), {
      timeoutDuration: 5000,
    });
    keySets.set(tenant, keys);
  }
  const { payload } = await jwtVerify(token, keys, { issuer, audience, algorithms: ["RS256"], requiredClaims: ["exp", "iat", "oid", "tid"] });
  return payload;
};

export class EntraProxyAuthenticationError extends AuthenticationError {
  constructor() { super("Identidad corporativa no disponible o inválida", 401); }
}

export async function resolveEntraProxyPrincipal(
  requestHeaders: Pick<Headers, "get">,
  env: NodeJS.ProcessEnv = process.env,
  verify: TokenVerifier = verifyEntraToken,
): Promise<string> {
  readRuntimeConfiguration(env);
  const supplied = requestHeaders.get("x-covex-proxy-secret") ?? "";
  const expected = env.AUTH_PROXY_SECRET ?? "";
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    throw new EntraProxyAuthenticationError();
  }
  const authorization = requestHeaders.get("x-covex-entra-token") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization);
  if (!match || match[1].length > 32768) throw new EntraProxyAuthenticationError();
  try {
    const claims = await verify(match[1], env.ENTRA_TENANT_ID!, env.ENTRA_CLIENT_ID!);
    if (claims.tid !== env.ENTRA_TENANT_ID || typeof claims.oid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.oid)) {
      throw new EntraProxyAuthenticationError();
    }
    return claims.oid;
  } catch {
    // Never forward provider errors, tokens or secret values to clients or logs.
    throw new EntraProxyAuthenticationError();
  }
}
