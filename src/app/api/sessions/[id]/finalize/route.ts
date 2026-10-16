import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/app/api/_error-response";
import { getApiUser } from "@/auth/api-user";
import { validateFinalizeSession } from "@/domain/training-session";
import { getSessionRepository } from "@/server/session-repositories";
import { SessionAuthorizationError, SessionImmutableFieldError, SessionRelationError, SessionStateError } from "@/server/session-repository";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const session = await getSessionRepository().finalize((await context.params).id, validateFinalizeSession(await request.json()), auth.user);
    return session ? NextResponse.json(session) : NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error, {
      known: [SessionAuthorizationError, SessionImmutableFieldError, SessionRelationError, SessionStateError],
      status: (caught) => caught instanceof SessionAuthorizationError ? 403 : 400,
    });
  }
}
