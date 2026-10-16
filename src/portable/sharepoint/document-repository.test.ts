import { describe, expect, it, vi } from "vitest";
import { SharePointDocumentRepository } from "./document-repository";

describe("SharePointDocumentRepository", () => {
  it("uploads a document under its Training folder", async () => {
    const graph = {
      request: vi.fn(),
      requestUpload: vi.fn(),
      requestJson: vi.fn()
        .mockResolvedValueOnce({ id: "folder-root" })
        .mockResolvedValueOnce({ id: "folder-training" })
        .mockResolvedValueOnce({ id: "doc-1", name: "evidencia.pdf", size: 3, eTag: '"doc-etag"' }),
    };
    const repository = new SharePointDocumentRepository(graph, "site", "drive");
    await expect(repository.upload("training-1", "evidencia.pdf", "application/pdf", new Uint8Array([1, 2, 3])))
      .resolves.toMatchObject({ id: "doc-1", name: "evidencia.pdf", size: 3 });
    expect(graph.requestJson).toHaveBeenLastCalledWith(
      "/sites/site/drives/drive/root:/COVEX-Training-Manager/training-1/evidencia.pdf:/content?@microsoft.graph.conflictBehavior=fail",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("retrieves document content through Graph", async () => {
    const response = new Response("document-content");
    const graph = { request: vi.fn().mockResolvedValue(response), requestJson: vi.fn(), requestUpload: vi.fn() };
    const repository = new SharePointDocumentRepository(graph, "site", "drive");
    await expect(repository.download("doc-1")).resolves.toBe(response);
  });

  it("rejects path traversal and empty files", async () => {
    const graph = { request: vi.fn(), requestJson: vi.fn(), requestUpload: vi.fn() };
    const repository = new SharePointDocumentRepository(graph, "site", "drive");
    await expect(repository.upload("training-1", "../secret.txt", "text/plain", new Uint8Array([1]))).rejects.toThrow("nombre");
    await expect(repository.upload("training-1", "empty.bin", "application/octet-stream", new Uint8Array())).rejects.toThrow("250 MB");
  });

  it("uploads large documents in chunks without forwarding the Graph bearer token", async () => {
    const content = new Uint8Array(4 * 1024 * 1024 + 1);
    const graph = {
      request: vi.fn(),
      requestJson: vi.fn()
        .mockResolvedValueOnce({ id: "folder-root" })
        .mockResolvedValueOnce({ id: "folder-training" })
        .mockResolvedValueOnce({ uploadUrl: "https://tenant.up.1drv.com/upload/session" }),
      requestUpload: vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ nextExpectedRanges: ["3276800-"] }), { status: 202 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "large", name: "large.bin", size: content.byteLength, eTag: '"large-etag"' }), { status: 201 })),
    };
    const repository = new SharePointDocumentRepository(graph, "site", "drive");
    await expect(repository.upload("training-1", "large.bin", "application/octet-stream", content)).resolves.toMatchObject({ id: "large", size: content.byteLength });
    expect(graph.requestUpload).toHaveBeenCalledWith("https://tenant.up.1drv.com/upload/session", expect.objectContaining({ method: "PUT" }));
  });
});
