import { describe, expect, it } from "vitest";
import {
  FileUploadPolicyError,
  MAX_FILE_SIZE_BYTES,
  assertFileUploadEnvelope,
  secureDownloadHeaders,
  validateFileUploadContent,
} from "./file-upload-policy";

describe("file upload policy", () => {
  it("acepta PDF real y normaliza el MIME", () => {
    assertFileUploadEnvelope("evidencia.pdf", 8, []);
    expect(validateFileUploadContent("evidencia.pdf", Buffer.from("%PDF-1.7"))).toMatchObject({ mimeType: "application/pdf" });
  });

  it("rechaza ejecutables por extensión", () => {
    expect(() => assertFileUploadEnvelope("malware.exe", 4, [])).toThrow(FileUploadPolicyError);
  });

  it("rechaza contenido que no coincide con la extensión", () => {
    expect(() => validateFileUploadContent("falso.pdf", Buffer.from("texto normal"))).toThrow("no coincide");
  });

  it("mantiene el límite de 10 MB por archivo", () => {
    expect(() => assertFileUploadEnvelope("grande.pdf", MAX_FILE_SIZE_BYTES + 1, [])).toThrow("10 MB");
  });

  it("limita el número y volumen acumulado por registro", () => {
    expect(() => assertFileUploadEnvelope("extra.pdf", 1, Array.from({ length: 20 }, () => ({ sizeBytes: 1 })))).toThrow("20 archivos");
    expect(() => assertFileUploadEnvelope("extra.pdf", 6 * 1024 * 1024, [{ sizeBytes: 45 * 1024 * 1024 }])).toThrow("50 MB");
  });

  it("endurece las cabeceras de descarga y neutraliza el nombre", () => {
    const headers = secureDownloadHeaders('doc"\r\nX-Test: x.pdf', "application/pdf", 12);
    expect(headers["Content-Disposition"]).not.toContain("\r");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toContain("sandbox");
  });
});
