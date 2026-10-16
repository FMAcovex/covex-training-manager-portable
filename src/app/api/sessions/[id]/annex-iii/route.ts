import { getApiUser } from "@/auth/api-user";
import { getAnnexIIIService } from "@/annexes/annex-services";
import { AnnexIIIAuthorizationError, AnnexIIINotFoundError } from "@/annexes/annex-iii-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  try {
    const result = await getAnnexIIIService().generate((await context.params).id, auth.user);
    const body = new ArrayBuffer(result.bytes.byteLength);
    new Uint8Array(body).set(result.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
        "X-Template-Version-Id": result.templateVersionId,
        "X-Generated-Document-Id": result.generatedDocumentId,
      },
    });
  } catch (error) {
    const status = error instanceof AnnexIIIAuthorizationError ? 403 : error instanceof AnnexIIINotFoundError ? 404 : 400;
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "No se pudo generar el Anexo III" }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
