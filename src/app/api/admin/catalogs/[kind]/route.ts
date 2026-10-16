import { NextResponse } from "next/server";
import { getCatalogAdminRepository } from "@/administration/repositories";
import { catalogCreateSchema, catalogKindSchema } from "@/administration/types";
import { adminError, requireAdmin } from "../../_utils";

type Context = { params: Promise<{ kind: string }> };

export async function GET(_request: Request, context: Context) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  try {
    return NextResponse.json(
      await getCatalogAdminRepository().list(
        catalogKindSchema.parse((await context.params).kind),
      ),
    );
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: Request, context: Context) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  try {
    const kind = catalogKindSchema.parse((await context.params).kind);
    return NextResponse.json(
      await getCatalogAdminRepository().create(
        kind,
        catalogCreateSchema.parse(await request.json()),
        admin.actor,
      ),
      { status: 201 },
    );
  } catch (error) {
    return adminError(error);
  }
}
