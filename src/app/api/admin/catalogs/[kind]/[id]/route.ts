import { NextResponse } from "next/server";
import { getCatalogAdminRepository } from "@/administration/repositories";
import { catalogKindSchema, catalogUpdateSchema } from "@/administration/types";
import { adminError, requireAdmin } from "../../../_utils";

type Context = { params: Promise<{ kind: string; id: string }> };

export async function PATCH(request: Request, context: Context) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  try {
    const parameters = await context.params;
    const row = await getCatalogAdminRepository().update(
      catalogKindSchema.parse(parameters.kind),
      parameters.id,
      catalogUpdateSchema.parse(await request.json()),
      admin.actor,
    );
    return row
      ? NextResponse.json(row)
      : NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 });
  } catch (error) {
    return adminError(error);
  }
}
