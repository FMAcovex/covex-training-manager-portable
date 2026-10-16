import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/auth/api-user";
import { apiErrorResponse } from "@/app/api/_error-response";
import { getSessionRepository } from "@/server/session-repositories";
import { SessionAuthorizationError, SessionStateError } from "@/server/session-repository";

type Context = { params: Promise<{ id: string }> };
const inputSchema = z.object({ reason: z.string().trim().min(1, "El motivo de reapertura es obligatorio").max(1000) }).strict();

export async function POST(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const { reason } = inputSchema.parse(await request.json());
    const session = await getSessionRepository().reopen((await context.params).id, reason, auth.user);
    return session ? NextResponse.json(session) : NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error, {
      known: [SessionAuthorizationError, SessionStateError],
      status: (caught) => caught instanceof SessionAuthorizationError ? 403 : 409,
    });
  }
}
