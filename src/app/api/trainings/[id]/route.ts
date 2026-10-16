import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { canEditTraining } from "@/auth/current-user";
import { validateTraining } from "@/domain/training";
import { getTrainingRepository } from "@/server/training-repositories";
import { TrainingCatalogReferenceError, TrainingConflictError, TrainingYearImmutableError } from "@/server/training-repository";
import { apiErrorResponse } from "@/app/api/_error-response";
import { TrainerSelectionError } from "@/server/trainer-selection";
import { getTrainerRepository } from "@/server/trainer-repositories";
import { validateQualifiedTrainerSelection } from "@/server/trainer-selection";
import { getSessionRepository } from "@/server/session-repositories";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const training = await getTrainingRepository().findById((await context.params).id);
  return training ? NextResponse.json({ ...training, globalStatus: await getSessionRepository().trainingStatus(training.id) }) : NextResponse.json({ error: "Formación no encontrada" }, { status: 404 });
}

export async function PATCH(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canEditTraining(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const id = (await context.params).id;
    const repository = getTrainingRepository();
    const existing = await repository.findById(id);
    if (!existing) return NextResponse.json({ error: "Formación no encontrada" }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const expectedUpdatedAt = typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined;
    const { expectedUpdatedAt: _expectedUpdatedAt, ...trainingBody } = body;
    void _expectedUpdatedAt;
    const input = validateTraining(trainingBody);
    await validateQualifiedTrainerSelection(
      getTrainerRepository(),
      input.plannedTrainerPersonIds ?? [],
      input.originType === "EXTERNAL",
      existing.plannedTrainerPersonIds ?? (existing.plannedTrainerPersonId ? [existing.plannedTrainerPersonId] : []),
    );
    if (!expectedUpdatedAt) return NextResponse.json({ error: "Falta la versión de la formación que se está editando" }, { status: 400 });
    const training = await repository.update(id, input, auth.user.id, expectedUpdatedAt);
    return training ? NextResponse.json({ ...training, globalStatus: await getSessionRepository().trainingStatus(training.id) }) : NextResponse.json({ error: "Formación no encontrada" }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error, {
      known: [TrainingConflictError, TrainingCatalogReferenceError, TrainingYearImmutableError, TrainerSelectionError],
      status: (caught) => caught instanceof TrainingConflictError ? 409 : 400,
    });
  }
}
