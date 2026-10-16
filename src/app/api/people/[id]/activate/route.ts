import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { canManagePeople } from "@/auth/current-user";
import { getPeopleRepository } from "@/server/people-repositories";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canManagePeople(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const person = await getPeopleRepository().activate((await context.params).id, auth.user.id);
  return person ? NextResponse.json(person) : NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });
}
