import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { canAccessAdministration } from "@/auth/current-user";
import { validateTrainerQualification } from "@/domain/trainer";
import { getTrainerRepository } from "@/server/trainer-repositories";

export async function GET(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const parameters = new URL(request.url).searchParams;
  const currentOnly = parameters.get("currentOnly") === "true";
  const personType = parameters.get("personType");
  const includeAnnulled = parameters.get("includeAnnulled") === "true";
  return NextResponse.json(await getTrainerRepository().list({
    currentOnly,
    includeAnnulled,
    personType: personType === "INTERNAL" || personType === "EXTERNAL" ? personType : undefined,
  }));
}

export async function POST(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canAccessAdministration(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    return NextResponse.json(await getTrainerRepository().createQualification(validateTrainerQualification(await request.json()), auth.user.id), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos no válidos" }, { status: 400 });
  }
}
