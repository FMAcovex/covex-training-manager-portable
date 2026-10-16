import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { canCreateTraining } from "@/auth/current-user";
import { planningTypeSchema, trainingOriginTypeSchema, validateNewTraining, type TrainingFilters } from "@/domain/training";
import { calculateTrainingStatus } from "@/domain/training-session";
import { apiErrorResponse } from "@/app/api/_error-response";
import { TrainingCatalogReferenceError } from "@/server/training-repository";
import { TrainerSelectionError } from "@/server/trainer-selection";
import { getTrainingRepository } from "@/server/training-repositories";
import { getTrainerRepository } from "@/server/trainer-repositories";
import { validateQualifiedTrainerSelection } from "@/server/trainer-selection";
import { getSessionRepository } from "@/server/session-repositories";

export async function GET(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const parameters = new URL(request.url).searchParams;
  const year = Number(parameters.get("year"));
  const gmp = parameters.get("isGmp");
  const planningType = planningTypeSchema.safeParse(parameters.get("planningType"));
  const originType = trainingOriginTypeSchema.safeParse(parameters.get("originType"));
  const filters: TrainingFilters = {
    year: Number.isInteger(year) && year > 0 ? year : undefined,
    search: parameters.get("search") || undefined,
    planningType: planningType.success ? planningType.data : undefined,
    isGmp: gmp === "true" ? true : gmp === "false" ? false : undefined,
    trainingTypeId: parameters.get("trainingTypeId") || undefined,
    originType: originType.success ? originType.data : undefined,
    departmentId: parameters.get("departmentId") || undefined,
    trainerPersonId: parameters.get("trainerPersonId") || undefined,
    externalTrainerName: parameters.get("externalTrainerName") || undefined,
  };
  const trainings = await getTrainingRepository().list(filters);
  const allSessions = await getSessionRepository().listByTrainingIds(trainings.map((training) => training.id));
  const sessionsByTraining = new Map<string, typeof allSessions>();
  for (const training of trainings) sessionsByTraining.set(training.id, []);
  for (const session of allSessions) sessionsByTraining.get(session.trainingId)?.push(session);
  return NextResponse.json(trainings.map((training) => ({
    ...training,
    globalStatus: calculateTrainingStatus(sessionsByTraining.get(training.id) ?? []),
  })));
}

export async function POST(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const user = auth.user;
  if (!canCreateTraining(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const input = validateNewTraining(await request.json());
    await validateQualifiedTrainerSelection(getTrainerRepository(), input.plannedTrainerPersonIds ?? [], input.originType === "EXTERNAL");
    const training = await getTrainingRepository().create(input, user.id);
    return NextResponse.json(training, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, {
      known: [TrainingCatalogReferenceError, TrainerSelectionError],
      status: () => 400,
    });
  }
}
