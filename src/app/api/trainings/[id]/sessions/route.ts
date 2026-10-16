import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { validateSessionInput } from "@/domain/training-session";
import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";
import { getTrainerRepository } from "@/server/trainer-repositories";
import { validateQualifiedTrainerSelection } from "@/server/trainer-selection";
import { SessionAuthorizationError } from "@/server/session-repository";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await getSessionRepository().listByTraining((await context.params).id));
}
export async function POST(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const trainingId = (await context.params).id;
    const input = validateSessionInput({ ...(await request.json()), trainingId });
    const training = await getTrainingRepository().findById(trainingId);
    if (!training) return NextResponse.json({ error: "Formación no encontrada" }, { status: 404 });
    await validateQualifiedTrainerSelection(getTrainerRepository(), input.trainerPersonIds ?? [], training.originType === "EXTERNAL");
    return NextResponse.json(await getSessionRepository().create(input, auth.user), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos no válidos" }, { status: error instanceof SessionAuthorizationError ? 403 : 400 });
  }
}
