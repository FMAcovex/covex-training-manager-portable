import { getApiUser } from "@/auth/api-user";
import { getAnnexVService } from "@/annexes/annex-services";
import { PersonHistoryNotFoundError } from "@/history/person-history-service";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const year = Number(new URL(request.url).searchParams.get("year"));
  try {
    const result = await getAnnexVService().generate(id, year, auth.user);
    return new Response(Buffer.from(result.bytes), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${result.filename}"`, "X-Generated-Document-Id": result.generatedDocumentId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el Anexo V";
    return Response.json({ error: message }, { status: error instanceof PersonHistoryNotFoundError ? 404 : message.includes("autorizado") ? 403 : 400 });
  }
}
