import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { getDocumentControlService } from "@/document-control/services";
import { DocumentControlAuthorizationError, DocumentControlNotApplicableError } from "@/document-control/service";
import { secureDownloadHeaders } from "@/security/file-upload-policy";

type Context = { params: Promise<{ id: string; attachmentId: string }> };

function errorResponse(error: unknown) {
  const status = error instanceof DocumentControlAuthorizationError ? 403 : error instanceof DocumentControlNotApplicableError ? 409 : 400;
  return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo gestionar el documento" }, { status });
}

export async function GET(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const { id, attachmentId } = await context.params;
    const document = await getDocumentControlService().getAttachment(id, attachmentId, auth.user);
    if (!document) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    return new Response(new Uint8Array(document.content), {
      headers: secureDownloadHeaders(document.fileName, document.mimeType, document.sizeBytes),
    });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const { id, attachmentId } = await context.params;
    const removed = await getDocumentControlService().removeAttachment(id, attachmentId, auth.user);
    return removed ? NextResponse.json(removed) : NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  } catch (error) { return errorResponse(error); }
}
