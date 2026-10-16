import { getApiUser } from "@/auth/api-user";
import { getAnnexIVService } from "@/annexes/annex-services";

type Context = { params: Promise<{ year: string }> };
export async function POST(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const year = Number((await context.params).year);
  try {
    const result = await getAnnexIVService().generate(year, auth.user);
    return new Response(Buffer.from(result.bytes), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${result.filename}"`, "X-Generated-Document-Id": result.generatedDocumentId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el Anexo IV";
    return Response.json({ error: message }, { status: message.includes("autorizado") ? 403 : 400 });
  }
}
