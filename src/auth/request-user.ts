import { headers } from "next/headers";
import type { CurrentUser } from "@/auth/current-user";
import { getUserProfileRepository } from "@/administration/repositories";
import type { UserProfileRepository } from "@/administration/user-profile-repository";
import { readRuntimeConfiguration } from "@/config/runtime";
import { resolveEntraProxyPrincipal } from "@/auth/entra-proxy";

import { AuthenticationError } from "@/auth/errors";
export { AuthenticationError } from "@/auth/errors";

const demoUser: CurrentUser = { id: "demo-user", displayName: "Usuario Demo", role: "ADMIN" };

export async function resolveAppServiceUser(
  principalId: string | null | undefined,
  repository: UserProfileRepository = getUserProfileRepository(),
): Promise<CurrentUser> {
  const normalizedPrincipalId = principalId?.trim();
  if (!normalizedPrincipalId) throw new AuthenticationError("Identidad corporativa no disponible", 401);

  const profile = await repository.findByEntraObjectId(normalizedPrincipalId);
  if (!profile) throw new AuthenticationError("Usuario no registrado en COVEX Training Manager", 403);
  if (!profile.active) throw new AuthenticationError("Usuario desactivado", 403);

  return { id: profile.id, displayName: profile.displayName, role: profile.role };
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const config = readRuntimeConfiguration();
  if (config.authMode === "demo") return demoUser;

  const requestHeaders = await headers();
  if (config.authMode === "entra-proxy") {
    return resolveAppServiceUser(await resolveEntraProxyPrincipal(requestHeaders));
  }
  return resolveAppServiceUser(requestHeaders.get("x-ms-client-principal-id"));
}
