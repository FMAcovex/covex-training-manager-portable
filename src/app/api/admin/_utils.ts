import { NextResponse } from "next/server";
import { canAccessAdministration, getCurrentUser } from "@/auth/current-user";
import { AuthenticationError } from "@/auth/request-user";
import { AdminAuthorizationError, AdminConflictError, AdminNotFoundError } from "@/administration/types";
import { apiErrorResponse } from "@/app/api/_error-response";

export async function requireAdmin() {
  try {
    const user = await getCurrentUser();
    if (!canAccessAdministration(user)) return { response: forbidden() } as const;
    return { actor: user } as const;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return {
        response: NextResponse.json(
          { error: error.message },
          { status: error.status },
        ),
      } as const;
    }
    throw error;
  }
}

export function adminError(error: unknown) {
  return apiErrorResponse(error, {
    known: [AdminConflictError, AdminNotFoundError, AdminAuthorizationError],
    status: (caught) => caught instanceof AdminConflictError ? 409 : caught instanceof AdminNotFoundError ? 404 : caught instanceof AdminAuthorizationError ? 403 : 400,
  });
}

export const forbidden = () =>
  NextResponse.json({ error: "No autorizado" }, { status: 403 });
