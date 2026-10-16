import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/app/api/_error-response";
import { getApiUser } from "@/auth/api-user";
import { validateSessionInput } from "@/domain/training-session";
import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";
import { getTrainerRepository } from "@/server/trainer-repositories";
import { validateQualifiedTrainerSelection } from "@/server/trainer-selection";
import { SessionAuthorizationError, SessionImmutableFieldError, SessionRelationError, SessionStateError } from "@/server/session-repository";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const session = await getSessionRepository().findById((await context.params).id);
  return session ? NextResponse.json(session) : NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
}
export async function PATCH(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const id = (await context.params).id;
    const repository = getSessionRepository();
    const existing = await repository.findById(id);
    if (!existing) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    const input = validateSessionInput(await request.json());
    const training = await getTrainingRepository().findById(existing.trainingId);
    if (!training) return NextResponse.json({ error: "Formación no encontrada" }, { status: 400 });
    await validateQualifiedTrainerSelection(
      getTrainerRepository(),
      input.trainerPersonIds ?? [],
      training.originType === "EXTERNAL",
      existing.trainerPersonIds ?? (existing.trainerPersonId ? [existing.trainerPersonId] : []),
    );
    const session = await repository.update(id, input, auth.user);
    return session ? NextResponse.json(session) : NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error, {
      known: [SessionAuthorizationError, SessionImmutableFieldError, SessionRelationError, SessionStateError],
      status: (caught) => caught instanceof SessionAuthorizationError ? 403 : 400,
    });
  }
}
