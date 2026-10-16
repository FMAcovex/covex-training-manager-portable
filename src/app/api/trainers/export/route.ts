import { getApiUser } from "@/auth/api-user";
import { renderQualifiedTrainersDocx } from "@/annexes/qualified-trainers-docx";
import { getTrainerRepository } from "@/server/trainer-repositories";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const rows = await getTrainerRepository().list();
  const document = renderQualifiedTrainersDocx(rows);
  return new Response(new Uint8Array(document), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="Listado_Formadores_Cualificados_Anexo_III.docx"',
      "Content-Length": String(document.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
