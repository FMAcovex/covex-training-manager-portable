import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { apiErrorResponse } from "@/app/api/_error-response";
import { getTrainingClosureService } from "@/training-closure/services";
import { TrainingClosureAuthorizationError, TrainingClosureNotReadyError } from "@/training-closure/service";
import { TrainingClosureError } from "@/server/training-repository";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
const reopenSchema = z.object({ reason: z.string().trim().min(1, "El motivo de reapertura es obligatorio").max(1000) }).strict();

export async function GET(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const state = await getTrainingClosureService().evaluate((await context.params).id);
  return state ? NextResponse.json(state) : NextResponse.json({ error: "Formación no encontrada" }, { status: 404 });
}

export async function POST(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const training = await getTrainingClosureService().close((await context.params).id, auth.user);
    return training ? NextResponse.json(training) : NextResponse.json({ error: "Formación no encontrada" }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error, {
      known: [TrainingClosureAuthorizationError, TrainingClosureNotReadyError, TrainingClosureError],
      status: (caught) => caught instanceof TrainingClosureAuthorizationError ? 403 : 409,
    });
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const input = reopenSchema.parse(await request.json());
    const training = await getTrainingClosureService().reopen((await context.params).id, input.reason, auth.user);
    return training ? NextResponse.json(training) : NextResponse.json({ error: "Formación no encontrada" }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error, {
      known: [TrainingClosureAuthorizationError, TrainingClosureNotReadyError, TrainingClosureError],
      status: (caught) => caught instanceof TrainingClosureAuthorizationError ? 403 : 409,
    });
  }
}
