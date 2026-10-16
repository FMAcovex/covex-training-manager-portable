import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { documentControlInputSchema } from "@/document-control/types";
import { getDocumentControlService } from "@/document-control/services";
import { DocumentControlAuthorizationError, DocumentControlNotApplicableError } from "@/document-control/service";

type Context = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  const status = error instanceof DocumentControlAuthorizationError ? 403 : error instanceof DocumentControlNotApplicableError ? 409 : 400;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Datos no válidos" }, { status });
}

export async function GET(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const control = await getDocumentControlService().get((await context.params).id, auth.user);
    return control ? NextResponse.json(control) : NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const input = documentControlInputSchema.parse(await request.json());
    const control = await getDocumentControlService().update((await context.params).id, input, auth.user);
    return control ? NextResponse.json(control) : NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  } catch (error) { return errorResponse(error); }
}
