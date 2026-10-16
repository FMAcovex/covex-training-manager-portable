import { NextResponse } from "next/server";
import { getUserProfileRepository } from "@/administration/repositories";
import { userUpdateSchema } from "@/administration/types";
import { adminError, requireAdmin } from "../../_utils";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  try {
    const row = await getUserProfileRepository().update(
      (await context.params).id,
      userUpdateSchema.parse(await request.json()),
      admin.actor,
    );
    return row
      ? NextResponse.json(row)
      : NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  } catch (error) {
    return adminError(error);
  }
}
