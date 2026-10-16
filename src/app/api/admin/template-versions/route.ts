import { NextResponse } from "next/server";
import { getAnnexRepository } from "@/annexes/annex-repositories";
import { templateCreateSchema } from "@/administration/types";
import { adminError, requireAdmin } from "../_utils";

export async function GET() {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  return NextResponse.json(await getAnnexRepository().listAllTemplateVersions());
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  try {
    return NextResponse.json(
      await getAnnexRepository().registerTemplateVersion(
        templateCreateSchema.parse(await request.json()),
        admin.actor,
      ),
      { status: 201 },
    );
  } catch (error) {
    return adminError(error);
  }
}
