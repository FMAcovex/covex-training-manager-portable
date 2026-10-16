import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { canAccessAdministration } from "@/auth/current-user";
import { validateTrainerQualification } from "@/domain/trainer";
import { getTrainerRepository } from "@/server/trainer-repositories";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canAccessAdministration(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const result = await getTrainerRepository().updateQualification((await context.params).id, validateTrainerQualification(await request.json()), auth.user.id);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Cualificación no encontrada" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos no válidos" }, { status: 400 });
  }
}
