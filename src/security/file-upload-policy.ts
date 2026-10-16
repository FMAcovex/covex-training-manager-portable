export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_COLLECTION = 20;
export const MAX_COLLECTION_SIZE_BYTES = 50 * 1024 * 1024;

type ExistingFile = { sizeBytes: number };

type FileRule = {
  mimeType: string;
  kind: "pdf" | "zip-office" | "ole-office" | "png" | "jpeg" | "text";
};

const rules: Record<string, FileRule> = {
  pdf: { mimeType: "application/pdf", kind: "pdf" },
  doc: { mimeType: "application/msword", kind: "ole-office" },
  docx: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "zip-office" },
  xls: { mimeType: "application/vnd.ms-excel", kind: "ole-office" },
  xlsx: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "zip-office" },
  ppt: { mimeType: "application/vnd.ms-powerpoint", kind: "ole-office" },
  pptx: { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "zip-office" },
  txt: { mimeType: "text/plain; charset=utf-8", kind: "text" },
  csv: { mimeType: "text/csv; charset=utf-8", kind: "text" },
  png: { mimeType: "image/png", kind: "png" },
  jpg: { mimeType: "image/jpeg", kind: "jpeg" },
  jpeg: { mimeType: "image/jpeg", kind: "jpeg" },
};

export class FileUploadPolicyError extends Error {}

function extensionOf(fileName: string) {
  const normalized = fileName.trim();
  const index = normalized.lastIndexOf(".");
  return index > 0 ? normalized.slice(index + 1).toLocaleLowerCase("en") : "";
}

export function allowedFileExtensions() {
  return Object.keys(rules);
}

export function assertFileUploadEnvelope(fileName: string, sizeBytes: number, existing: ExistingFile[] = []) {
  const extension = extensionOf(fileName);
  if (!rules[extension]) {
    throw new FileUploadPolicyError(`Tipo de archivo no permitido. Formatos admitidos: ${allowedFileExtensions().join(", ")}`);
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new FileUploadPolicyError("Cada archivo debe ocupar entre 1 byte y 10 MB");
  }
  if (existing.length >= MAX_FILES_PER_COLLECTION) {
    throw new FileUploadPolicyError(`Se permiten como máximo ${MAX_FILES_PER_COLLECTION} archivos por registro`);
  }
  const currentBytes = existing.reduce((total, item) => total + item.sizeBytes, 0);
  if (currentBytes + sizeBytes > MAX_COLLECTION_SIZE_BYTES) {
    throw new FileUploadPolicyError("El conjunto de documentos no puede superar 50 MB por registro");
  }
  return rules[extension];
}

function startsWith(content: Buffer, bytes: number[]) {
  return content.length >= bytes.length && bytes.every((value, index) => content[index] === value);
}

function validText(content: Buffer) {
  const sample = content.subarray(0, Math.min(content.length, 8192));
  return !sample.includes(0);
}

export function validateFileUploadContent(fileName: string, content: Buffer) {
  const extension = extensionOf(fileName);
  const rule = rules[extension];
  if (!rule) throw new FileUploadPolicyError("Tipo de archivo no permitido");

  const valid = rule.kind === "pdf"
    ? startsWith(content, [0x25, 0x50, 0x44, 0x46])
    : rule.kind === "zip-office"
      ? startsWith(content, [0x50, 0x4b, 0x03, 0x04]) || startsWith(content, [0x50, 0x4b, 0x05, 0x06]) || startsWith(content, [0x50, 0x4b, 0x07, 0x08])
      : rule.kind === "ole-office"
        ? startsWith(content, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
        : rule.kind === "png"
          ? startsWith(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
          : rule.kind === "jpeg"
            ? startsWith(content, [0xff, 0xd8, 0xff])
            : validText(content);

  if (!valid) {
    throw new FileUploadPolicyError("El contenido del archivo no coincide con su extensión o no es un formato admitido");
  }
  return { mimeType: rule.mimeType, sizeBytes: content.byteLength };
}

export function secureDownloadHeaders(fileName: string, mimeType: string, sizeBytes: number) {
  const safeName = fileName.replace(/[\r\n"]/g, "_");
  return {
    "Content-Type": mimeType,
    "Content-Disposition": `attachment; filename="${safeName}"`,
    "Content-Length": String(sizeBytes),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
}
