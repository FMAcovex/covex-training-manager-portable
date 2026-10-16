import { delegatedGraphToken, portableApiError } from "@/portable/api";
import { readPortableServerConfiguration } from "@/portable/config";
import { GraphClient } from "@/portable/graph/graph-client";
import { SharePointDocumentRepository } from "@/portable/sharepoint/document-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const config = readPortableServerConfiguration();
    const repository = new SharePointDocumentRepository(
      new GraphClient(delegatedGraphToken(request)),
      config.siteId,
      config.documentDriveId,
    );
    const response = await repository.download((await context.params).id);
    const headers = new Headers();
    headers.set("Content-Type", response.headers.get("content-type") ?? "application/octet-stream");
    headers.set("Cache-Control", "no-store");
    const disposition = response.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);
    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    return portableApiError(error);
  }
}
