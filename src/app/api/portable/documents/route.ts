import { NextResponse } from "next/server";
import { delegatedGraphToken, portableApiError } from "@/portable/api";
import { readPortableServerConfiguration } from "@/portable/config";
import { GraphClient } from "@/portable/graph/graph-client";
import { SharePointDocumentRepository } from "@/portable/sharepoint/document-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const config = readPortableServerConfiguration();
    const form = await request.formData();
    const trainingId = form.get("trainingId");
    const file = form.get("file");
    if (typeof trainingId !== "string" || !(file instanceof File)) {
      return NextResponse.json({ error: "Se requieren trainingId y file." }, { status: 400 });
    }
    const repository = new SharePointDocumentRepository(
      new GraphClient(delegatedGraphToken(request)),
      config.siteId,
      config.documentDriveId,
    );
    const content = new Uint8Array(await file.arrayBuffer());
    return NextResponse.json(await repository.upload(trainingId, file.name, file.type, content), { status: 201 });
  } catch (error) {
    return portableApiError(error);
  }
}
