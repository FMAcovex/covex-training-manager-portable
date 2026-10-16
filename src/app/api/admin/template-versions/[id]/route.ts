import { NextResponse } from "next/server";
import { getAnnexRepository } from "@/annexes/annex-repositories";
import { templateUpdateSchema } from "@/administration/types";
import { adminError, requireAdmin } from "../../_utils";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  try {
    const row = await getAnnexRepository().updateTemplateVersion(
      (await context.params).id,
      templateUpdateSchema.parse(await request.json()),
      admin.actor,
    );
    return row
      ? NextResponse.json(row)
      : NextResponse.json({ error: "Versión no encontrada" }, { status: 404 });
  } catch (error) {
    return adminError(error);
  }
}
