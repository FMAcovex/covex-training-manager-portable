import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { canAccessAdministration } from "@/auth/current-user";
import { validatePerson } from "@/domain/person";
import { validateTrainerQualification } from "@/domain/trainer";
import { getTrainerRepository } from "@/server/trainer-repositories";

export async function POST(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canAccessAdministration(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const body = await request.json() as { person?: unknown; qualification?: unknown };
    const person = validatePerson(body.person);
    const qualification = validateTrainerQualification({
      ...(typeof body.qualification === "object" && body.qualification !== null ? body.qualification : {}),
      personId: "new-qualified-trainer",
    });
    const qualificationWithoutPerson = {
      authorizedSubject: qualification.authorizedSubject,
      evidence: qualification.evidence,
      qualifiedFrom: qualification.qualifiedFrom,
      qualifiedTo: qualification.qualifiedTo,
    };
    const created = await getTrainerRepository().createQualifiedTrainer(person, qualificationWithoutPerson, auth.user.id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos no válidos" }, { status: 400 });
  }
}
