import { describe, expect, it, vi } from "vitest";
import { GraphClient, GraphConflictError, GraphRequestError } from "./graph-client";

function json(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" }, ...init });
}

describe("GraphClient", () => {
  it("bounds stalled requests and does not retry an uncertain write", async () => {
    let signal: AbortSignal | null | undefined;
    const fetcher = vi.fn(async (_url, init) => { signal = init?.signal; return new Promise<Response>(() => {}); });
    const client = new GraphClient("synthetic-token", { fetch: fetcher, timeoutMs: 10 });
    await expect(client.request("/synthetic", { method: "POST" })).rejects.toMatchObject({ code: "requestTimeout", status: 504 });
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bounds a stalled response body and pre-authenticated uploads", async () => {
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ start() {} })));
    const client = new GraphClient("synthetic-token", { fetch: fetcher, timeoutMs: 10 });
    await expect(client.requestJson("/synthetic")).rejects.toMatchObject({ code: "requestTimeout" });
    await expect(client.requestUpload("https://synthetic.sharepoint.com/upload", { method: "PUT" })).rejects.toMatchObject({ code: "requestTimeout" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("follows Graph pagination and keeps the delegated token out of results", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ value: [{ id: "1" }], "@odata.nextLink": "https://graph.microsoft.com/v1.0/sites/site/lists/list/items?page=2" }))
      .mockResolvedValueOnce(json({ value: [{ id: "2" }] }));
    const client = new GraphClient("delegated-token-value-long-enough", { fetch: fetcher });

    await expect(client.paginate<{ id: string }>("/sites/site/lists/list/items")).resolves.toEqual([{ id: "1" }, { id: "2" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((fetcher.mock.calls[0][1]?.headers as Headers).get("Authorization")).toBe("Bearer delegated-token-value-long-enough");
  });

  it("retries throttling using Retry-After", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ error: { code: "tooManyRequests" } }, { status: 429, headers: { "Retry-After": "1" } }))
      .mockResolvedValueOnce(json({ value: [] }));
    const client = new GraphClient("delegated-token-value-long-enough", { fetch: fetcher, sleep });

    await expect(client.paginate("/sites/site/lists/list/items")).resolves.toEqual([]);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("recovers from a temporary Graph 503", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ error: { code: "serviceUnavailable" } }, { status: 503 }))
      .mockResolvedValueOnce(json({ value: [{ id: "recovered" }] }));
    const client = new GraphClient("delegated-token-value-long-enough", { fetch: fetcher, sleep });
    await expect(client.paginate<{ id: string }>("/sites/site/lists/list/items")).resolves.toEqual([{ id: "recovered" }]);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("paginates beyond SharePoint's 5000-item view threshold", async () => {
    const first = Array.from({ length: 5000 }, (_, id) => ({ id: String(id) }));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ value: first, "@odata.nextLink": "https://graph.microsoft.com/v1.0/sites/site/lists/list/items?page=2" }))
      .mockResolvedValueOnce(json({ value: [{ id: "5000" }] }));
    const client = new GraphClient("delegated-token-value-long-enough", { fetch: fetcher });
    await expect(client.paginate<{ id: string }>("/sites/site/lists/list/items")).resolves.toHaveLength(5001);
  });

  it("turns HTTP 412 into a readable concurrency conflict", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: { code: "preconditionFailed" } }, { status: 412 }));
    const client = new GraphClient("delegated-token-value-long-enough", { fetch: fetcher, maxRetries: 0 });
    await expect(client.requestJson("/sites/site/lists/list/items/1", { method: "PATCH" })).rejects.toBeInstanceOf(GraphConflictError);
  });

  it("does not blindly repeat a POST after an uncertain server failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: { code: "serviceUnavailable" } }, { status: 503 }));
    const client = new GraphClient("delegated-token-value-long-enough", { fetch: fetcher, sleep: vi.fn() });
    await expect(client.requestJson("/sites/site/lists/list/items", { method: "POST", body: "{}" })).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects pagination outside graph.microsoft.com", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ value: [], "@odata.nextLink": "https://attacker.invalid/collect" }));
    const client = new GraphClient("delegated-token-value-long-enough", { fetch: fetcher });
    await expect(client.paginate("/sites/site/lists/list/items")).rejects.toMatchObject<Partial<GraphRequestError>>({ code: "invalidNextLink" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never sends delegated tokens to arbitrary upload-session hosts", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const client = new GraphClient("delegated-token-value-long-enough", { fetch: fetcher });
    await expect(client.requestUpload("https://attacker.invalid/upload", { method: "PUT" })).rejects.toMatchObject({ code: "invalidUploadUrl" });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(client.requestUpload("https://tenant.up.1drv.com/upload", { method: "PUT" })).resolves.toMatchObject({ status: 202 });
    expect((fetcher.mock.calls[0][1]?.headers as Headers | undefined)?.get?.("Authorization") ?? null).toBeNull();
  });
});
