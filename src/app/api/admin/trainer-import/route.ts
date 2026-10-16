import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/admin/_utils";
import { commitTrainerImport, previewTrainerImport, TrainerImportValidationError } from "@/imports/trainer-import-service";
import type { TrainerImportMappings } from "@/imports/trainer-import-types";
import { getPeopleRepository } from "@/server/people-repositories";
import { getTrainerRepository } from "@/server/trainer-repositories";
import { assertFileUploadEnvelope, validateFileUploadContent } from "@/security/file-upload-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const action = form.get("action");
    if (!(file instanceof File) || !file.name.toLocaleLowerCase().endsWith(".docx")) return NextResponse.json({ error: "Selecciona el Anexo III en formato .docx" }, { status: 400 });
    assertFileUploadEnvelope(file.name, file.size);
    if (action !== "preview" && action !== "commit") return NextResponse.json({ error: "Acción de importación no válida" }, { status: 400 });
    const mappingsValue = form.get("mappings");
    const mappings: TrainerImportMappings = typeof mappingsValue === "string" && mappingsValue ? JSON.parse(mappingsValue) : {};
    const buffer = Buffer.from(await file.arrayBuffer());
    validateFileUploadContent(file.name, buffer);
    const people = getPeopleRepository();
    const trainers = getTrainerRepository();
    if (action === "preview") return NextResponse.json(await previewTrainerImport(buffer, mappings, people, trainers));
    return NextResponse.json(await commitTrainerImport(buffer, mappings, auth.actor, people, trainers), { status: 201 });
  } catch (error) {
    if (error instanceof TrainerImportValidationError) return NextResponse.json({ error: error.message, preview: error.preview }, { status: 422 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Las correspondencias no tienen un formato válido" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo procesar el documento" }, { status: 400 });
  }
}
