import type { GraphClient } from "@/portable/graph/graph-client";

const MAX_SIMPLE_UPLOAD_BYTES = 4 * 1024 * 1024;

export type PortableDocument = {
  id: string;
  name: string;
  size: number;
  eTag: string;
  webUrl?: string;
};

type GraphDriveItem = {
  id: string;
  name: string;
  size: number;
  eTag: string;
  webUrl?: string;
};

function segment(value: string) {
  return encodeURIComponent(value);
}

function safeFileName(value: string) {
  const name = value.trim();
  if (!name || name.length > 180 || /[\\/:*?"<>|\u0000-\u001f]/.test(name) || name === "." || name === "..") {
    throw new Error("El nombre del documento no es válido para SharePoint.");
  }
  return name;
}

function toDocument(item: GraphDriveItem): PortableDocument {
  if (!item.id || !item.name || !item.eTag || !Number.isFinite(item.size)) {
    throw new Error("Microsoft Graph devolvió metadatos de documento no válidos.");
  }
  return { id: item.id, name: item.name, size: item.size, eTag: item.eTag, webUrl: item.webUrl };
}

export class SharePointDocumentRepository {
  constructor(
    private readonly graph: Pick<GraphClient, "request" | "requestJson">,
    private readonly siteId: string,
    private readonly driveId: string,
  ) {}

  async upload(trainingId: string, fileName: string, mimeType: string, content: Uint8Array) {
    if (!trainingId.trim()) throw new Error("La Formación es obligatoria para archivar el documento.");
    if (content.byteLength === 0 || content.byteLength > MAX_SIMPLE_UPLOAD_BYTES) {
      throw new Error("El prototipo admite documentos de entre 1 byte y 4 MB.");
    }
    const path = ["COVEX-Training-Manager", trainingId, safeFileName(fileName)].map(segment).join("/");
    const uploadBody = new Uint8Array(content).buffer;
    const item = await this.graph.requestJson<GraphDriveItem>(
      `/sites/${segment(this.siteId)}/drives/${segment(this.driveId)}/root:/${path}:/content?@microsoft.graph.conflictBehavior=fail`,
      { method: "PUT", body: uploadBody, headers: { "Content-Type": mimeType || "application/octet-stream" } },
    );
    return toDocument(item);
  }

  async download(documentId: string) {
    if (!documentId.trim()) throw new Error("El identificador del documento es obligatorio.");
    return this.graph.request(`/sites/${segment(this.siteId)}/drives/${segment(this.driveId)}/items/${segment(documentId)}/content`);
  }
}
