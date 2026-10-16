import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { getDocumentControlService } from "@/document-control/services";
import { DocumentControlAuthorizationError } from "@/document-control/service";
import type { DocumentationFilters } from "@/document-control/types";

export async function GET(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const query = new URL(request.url).searchParams;
  const status = query.get("status") ?? "PRINT_PENDING";
  const rawYear = query.get("year");
  const year = rawYear ? Number(rawYear) : undefined;
  if (!['PRINT_PENDING', 'DOCUMENTATION_PENDING', 'CONFORMING', 'ALL'].includes(status)) return NextResponse.json({ error: "El estado documental no es válido" }, { status: 400 });
  if (year !== undefined && (!Number.isInteger(year) || year < 1000 || year > 9999)) return NextResponse.json({ error: "El año no es válido" }, { status: 400 });
  const filters: DocumentationFilters = { status: status as DocumentationFilters["status"], year, search: query.get("search") || undefined, trainingId: query.get("trainingId") || undefined };
  try { return NextResponse.json(await getDocumentControlService().list(auth.user, filters)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar la documentación" }, { status: error instanceof DocumentControlAuthorizationError ? 403 : 400 }); }
}
