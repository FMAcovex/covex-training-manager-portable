import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { canAccessAdministration } from "@/auth/current-user";
import { trainerQualificationRetireSchema } from "@/domain/trainer";
import { getTrainerRepository } from "@/server/trainer-repositories";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canAccessAdministration(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { qualifiedTo } = trainerQualificationRetireSchema.parse(await request.json());
    const result = await getTrainerRepository().retireQualification((await context.params).id, qualifiedTo, auth.user.id);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Cualificación no encontrada" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos no válidos" }, { status: 400 });
  }
}
