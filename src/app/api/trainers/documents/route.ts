import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { canAccessAdministration, canReadTrainerDocuments } from "@/auth/current-user";
import { getTrainerRepository } from "@/server/trainer-repositories";
import { assertFileUploadEnvelope, validateFileUploadContent } from "@/security/file-upload-policy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canReadTrainerDocuments(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const personId = new URL(request.url).searchParams.get("personId");
  const repository = getTrainerRepository();
  return NextResponse.json(personId ? await repository.listDocuments(personId) : await repository.listAllDocuments());
}

export async function POST(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canAccessAdministration(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const form = await request.formData();
    const personId = form.get("personId");
    const file = form.get("file");
    if (typeof personId !== "string" || !personId) return NextResponse.json({ error: "Falta el formador" }, { status: 400 });
    if (!(file instanceof File) || !file.name) return NextResponse.json({ error: "Selecciona un archivo válido" }, { status: 400 });
    const repository = getTrainerRepository();
    const existing = await repository.listDocuments(personId);
    assertFileUploadEnvelope(file.name, file.size, existing);
    const content = Buffer.from(await file.arrayBuffer());
    const validated = validateFileUploadContent(file.name, content);
    return NextResponse.json(await repository.addDocument(personId, {
      fileName: file.name,
      mimeType: validated.mimeType,
      content,
    }, auth.user.id), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo adjuntar el archivo" }, { status: 400 });
  }
}
