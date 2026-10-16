import { GraphRequestError, type GraphClient } from "@/portable/graph/graph-client";

const MAX_SIMPLE_UPLOAD_BYTES = 4 * 1024 * 1024;
const UPLOAD_CHUNK_BYTES = 10 * 320 * 1024;
const MAX_DOCUMENT_BYTES = 250 * 1024 * 1024;

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
    private readonly graph: Pick<GraphClient, "request" | "requestJson" | "requestUpload">,
    private readonly siteId: string,
    private readonly driveId: string,
  ) {}

  private async ensureFolder(parts: string[]) {
    let parent = "root";
    for (const rawName of parts) {
      const name = safeFileName(rawName);
      const lookup = parent === "root"
        ? `/sites/${segment(this.siteId)}/drives/${segment(this.driveId)}/root:/${segment(name)}:`
        : `/sites/${segment(this.siteId)}/drives/${segment(this.driveId)}/items/${segment(parent)}:/${segment(name)}:`;
      try {
        const found = await this.graph.requestJson<GraphDriveItem>(lookup);
        parent = found.id;
      } catch (error) {
        if (!(error instanceof GraphRequestError) || error.status !== 404) throw error;
        const children = parent === "root"
          ? `/sites/${segment(this.siteId)}/drives/${segment(this.driveId)}/root/children`
          : `/sites/${segment(this.siteId)}/drives/${segment(this.driveId)}/items/${segment(parent)}/children`;
        try {
          const created = await this.graph.requestJson<GraphDriveItem>(children, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
          });
          parent = created.id;
        } catch (createError) {
          if (!(createError instanceof GraphRequestError) || createError.status !== 409) throw createError;
          parent = (await this.graph.requestJson<GraphDriveItem>(lookup)).id;
        }
      }
    }
  }

  async upload(trainingId: string, fileName: string, mimeType: string, content: Uint8Array) {
    if (!trainingId.trim()) throw new Error("La Formación es obligatoria para archivar el documento.");
    const validatedFileName = safeFileName(fileName);
    if (content.byteLength === 0 || content.byteLength > MAX_DOCUMENT_BYTES) {
      throw new Error("El documento debe tener entre 1 byte y 250 MB.");
    }
    const folders = trainingId.split("/");
    if (folders.some((part) => !part || part !== safeFileName(part))) throw new Error("La ruta del documento no es válida.");
    await this.ensureFolder(["COVEX-Training-Manager", ...folders]);
    const path = ["COVEX-Training-Manager", ...folders, validatedFileName].map(segment).join("/");
    const uploadBody = new Uint8Array(content).buffer;
    if (content.byteLength <= MAX_SIMPLE_UPLOAD_BYTES) {
      const item = await this.graph.requestJson<GraphDriveItem>(
        `/sites/${segment(this.siteId)}/drives/${segment(this.driveId)}/root:/${path}:/content?@microsoft.graph.conflictBehavior=fail`,
        { method: "PUT", body: uploadBody, headers: { "Content-Type": mimeType || "application/octet-stream" } },
      );
      return toDocument(item);
    }

    const session = await this.graph.requestJson<{ uploadUrl: string }>(
      `/sites/${segment(this.siteId)}/drives/${segment(this.driveId)}/root:/${path}:/createUploadSession`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "fail", name: validatedFileName } }) },
    );
    if (!session.uploadUrl) throw new Error("Microsoft Graph no devolvió la sesión de carga del documento.");
    let result: GraphDriveItem | undefined;
    for (let start = 0; start < content.byteLength; start += UPLOAD_CHUNK_BYTES) {
      const endExclusive = Math.min(start + UPLOAD_CHUNK_BYTES, content.byteLength);
      const chunk = content.slice(start, endExclusive);
      const response = await this.graph.requestUpload(session.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunk.byteLength),
          "Content-Range": `bytes ${start}-${endExclusive - 1}/${content.byteLength}`,
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(chunk).buffer,
      });
      if (response.status === 200 || response.status === 201) {
        if (endExclusive !== content.byteLength) throw new Error("SharePoint finalizó la carga antes de recibir todo el documento.");
        result = await response.json() as GraphDriveItem;
      }
      else if (response.status !== 202) throw new Error(`Estado inesperado ${response.status} durante la carga por bloques.`);
    }
    if (!result) throw new Error("La carga por bloques finalizó sin metadatos del documento.");
    if (result.size !== content.byteLength) throw new Error("El tamaño del documento archivado no coincide con el original.");
    return toDocument(result);
  }

  async download(documentId: string) {
    if (!documentId.trim()) throw new Error("El identificador del documento es obligatorio.");
    return this.graph.request(`/sites/${segment(this.siteId)}/drives/${segment(this.driveId)}/items/${segment(documentId)}/content`);
  }

  async delete(documentId: string, eTag?: string) {
    if (!documentId.trim()) throw new Error("El identificador del documento es obligatorio.");
    await this.graph.request(`/sites/${segment(this.siteId)}/drives/${segment(this.driveId)}/items/${segment(documentId)}`, {
      method: "DELETE",
      headers: eTag ? { "If-Match": eTag } : undefined,
    });
  }
}
