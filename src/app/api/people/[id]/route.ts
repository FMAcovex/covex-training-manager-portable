import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { getPeopleRepository } from "@/server/people-repositories";
import { PeopleDepartmentReferenceError } from "@/server/people-repository";
import { apiErrorResponse } from "@/app/api/_error-response";
import { canManagePeople } from "@/auth/current-user";
import { validatePerson } from "@/domain/person";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canManagePeople(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await context.params;
  const repository = getPeopleRepository();
  const existing = await repository.findById(id);
  if (!existing) return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });
  try { return NextResponse.json(await repository.update(id, validatePerson({ ...existing, ...(await request.json()) }), auth.user.id) ); }
  catch (error) { return apiErrorResponse(error, { known: [PeopleDepartmentReferenceError], status: () => 400 }); }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canManagePeople(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await context.params;
  const person = await getPeopleRepository().deactivate(id, auth.user.id);
  return person ? NextResponse.json(person) : NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });
}
