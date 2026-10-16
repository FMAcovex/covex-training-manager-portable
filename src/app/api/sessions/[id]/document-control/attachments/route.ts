import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { documentControlAttachmentCategorySchema } from "@/document-control/types";
import { getDocumentControlService } from "@/document-control/services";
import { DocumentControlAuthorizationError, DocumentControlNotApplicableError } from "@/document-control/service";
import { assertFileUploadEnvelope, validateFileUploadContent } from "@/security/file-upload-policy";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  const status = error instanceof DocumentControlAuthorizationError ? 403 : error instanceof DocumentControlNotApplicableError ? 409 : 400;
  return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo gestionar el documento" }, { status });
}

export async function POST(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const form = await request.formData();
    const category = documentControlAttachmentCategorySchema.parse(form.get("category"));
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) return NextResponse.json({ error: "Selecciona un archivo válido" }, { status: 400 });
    const sessionId = (await context.params).id;
    const service = getDocumentControlService();
    const state = await service.get(sessionId, auth.user);
    if (!state) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    assertFileUploadEnvelope(file.name, file.size, state.attachments);
    const content = Buffer.from(await file.arrayBuffer());
    const validated = validateFileUploadContent(file.name, content);
    const created = await service.addAttachment(sessionId, {
      category,
      fileName: file.name,
      mimeType: validated.mimeType,
      content,
    }, auth.user);
    return created ? NextResponse.json(created, { status: 201 }) : NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  } catch (error) { return errorResponse(error); }
}
