import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { getPersonHistoryService } from "@/history/person-history-services";
import { PersonHistoryNotFoundError } from "@/history/person-history-service";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const rawYear = new URL(request.url).searchParams.get("year");
  const year = rawYear ? Number(rawYear) : undefined;
  if (year !== undefined && (!Number.isInteger(year) || year < 1000 || year > 9999)) return NextResponse.json({ error: "El año no es válido" }, { status: 400 });
  try { return NextResponse.json(await getPersonHistoryService().get(id, auth.user, year)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar el historial" }, { status: error instanceof PersonHistoryNotFoundError ? 404 : 403 }); }
}
