import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { validatePerson } from "@/domain/person";
import { canManagePeople } from "@/auth/current-user";
import { getPeopleRepository } from "@/server/people-repositories";
import { PeopleDepartmentReferenceError } from "@/server/people-repository";
import { apiErrorResponse } from "@/app/api/_error-response";

export async function GET() {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await getPeopleRepository().list());
}

export async function POST(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canManagePeople(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const input = validatePerson(await request.json());
    const person = await getPeopleRepository().create(input, auth.user.id);
    return NextResponse.json(person, { status: 201 });
  } catch (error) { return apiErrorResponse(error, { known: [PeopleDepartmentReferenceError], status: () => 400 }); }
}
