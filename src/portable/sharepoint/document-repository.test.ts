import { describe, expect, it, vi } from "vitest";
import { SharePointDocumentRepository } from "./document-repository";

describe("SharePointDocumentRepository", () => {
  it("uploads a document under its Training folder", async () => {
    const graph = {
      request: vi.fn(),
      requestJson: vi.fn().mockResolvedValue({ id: "doc-1", name: "evidencia.pdf", size: 3, eTag: '"doc-etag"' }),
    };
    const repository = new SharePointDocumentRepository(graph, "site", "drive");
    await expect(repository.upload("training-1", "evidencia.pdf", "application/pdf", new Uint8Array([1, 2, 3])))
      .resolves.toMatchObject({ id: "doc-1", name: "evidencia.pdf", size: 3 });
    expect(graph.requestJson).toHaveBeenCalledWith(
      "/sites/site/drives/drive/root:/COVEX-Training-Manager/training-1/evidencia.pdf:/content?@microsoft.graph.conflictBehavior=fail",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("retrieves document content through Graph", async () => {
    const response = new Response("document-content");
    const graph = { request: vi.fn().mockResolvedValue(response), requestJson: vi.fn() };
    const repository = new SharePointDocumentRepository(graph, "site", "drive");
    await expect(repository.download("doc-1")).resolves.toBe(response);
  });

  it("rejects path traversal and files larger than the simple upload limit", async () => {
    const graph = { request: vi.fn(), requestJson: vi.fn() };
    const repository = new SharePointDocumentRepository(graph, "site", "drive");
    await expect(repository.upload("training-1", "../secret.txt", "text/plain", new Uint8Array([1]))).rejects.toThrow("nombre");
    await expect(repository.upload("training-1", "large.bin", "application/octet-stream", new Uint8Array(4 * 1024 * 1024 + 1))).rejects.toThrow("4 MB");
  });
});
