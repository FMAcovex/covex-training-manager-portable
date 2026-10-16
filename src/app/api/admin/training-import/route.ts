import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/app/api/admin/_utils";
import { commitTrainingImport, previewTrainingImport, TrainingImportConflictError, TrainingImportValidationError } from "@/imports/training-import-service";
import { assertFileUploadEnvelope, validateFileUploadContent } from "@/security/file-upload-policy";

export const runtime = "nodejs";


export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const action = form.get("action");
    if (!(file instanceof File) || !file.name.toLocaleLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "Selecciona un archivo .xlsx válido" }, { status: 400 });
    assertFileUploadEnvelope(file.name, file.size);
    if (action !== "preview" && action !== "commit") return NextResponse.json({ error: "Acción de importación no válida" }, { status: 400 });
    const mappingsValue = form.get("mappings");
    const mappings = typeof mappingsValue === "string" && mappingsValue ? JSON.parse(mappingsValue) : undefined;
    const buffer = Buffer.from(await file.arrayBuffer());
    validateFileUploadContent(file.name, buffer);
    if (action === "preview") return NextResponse.json(await previewTrainingImport(buffer, file.name, mappings));
    return NextResponse.json(await commitTrainingImport(buffer, file.name, mappings, auth.actor), { status: 201 });
  } catch (error) {
    if (error instanceof TrainingImportValidationError) return NextResponse.json({ error: error.message, preview: error.preview }, { status: 422 });
    if (error instanceof TrainingImportConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Los mapeos no son válidos" }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Los mapeos no tienen un formato válido" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo procesar el archivo" }, { status: 400 });
  }
}

