import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { canAccessAdministration, canReadTrainerDocuments } from "@/auth/current-user";
import { getTrainerRepository } from "@/server/trainer-repositories";
import { secureDownloadHeaders } from "@/security/file-upload-policy";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canReadTrainerDocuments(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const document = await getTrainerRepository().getDocument((await context.params).id);
  if (!document) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  return new Response(new Uint8Array(document.content), {
    headers: secureDownloadHeaders(document.fileName, document.mimeType, document.sizeBytes),
  });
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  if (!canAccessAdministration(auth.user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const removed = await getTrainerRepository().removeDocument((await context.params).id, auth.user.id);
  return removed ? NextResponse.json(removed) : NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
}
