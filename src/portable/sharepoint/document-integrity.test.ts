import { describe, expect, it, vi } from "vitest";
import { InMemoryPortableEntityStore } from "./entity-store";
import { createPortableProvider } from "./provider";

const mocks = vi.hoisted(() => ({ download: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/portable/auth/server-session", () => ({ portableAccessToken: async () => "synthetic-only" }));
vi.mock("@/portable/config", () => ({ readPortableServerConfiguration: () => ({ siteId: "synthetic", documentDriveId: "synthetic", listPrefix: "COVEX", trainingsListId: "Training" }) }));
vi.mock("./document-repository", () => ({ SharePointDocumentRepository: class { upload = mocks.upload; download = mocks.download; delete = mocks.remove; } }));

describe("portable document integrity", () => {
  it("stores SHA-256 and rejects same-size content changed outside the application", async () => {
    const raw = new InMemoryPortableEntityStore();
    await raw.create("Person", "synthetic-person", { id: "synthetic-person", active: true });
    const provider = createPortableProvider(raw);
    mocks.upload.mockResolvedValue({ id: "drive-file", eTag: '"file-etag"', name: "evidence.txt", size: 4 });
    const document = await provider.trainers.addDocument("synthetic-person", { fileName: "evidence.txt", mimeType: "text/plain", content: Buffer.from("test") }, "actor");
    const stored = await raw.get<{ sha256: string }>("TrainerDocument", document.id);
    expect(stored?.data.sha256).toMatch(/^[a-f0-9]{64}$/);
    mocks.download.mockImplementation(async () => new Response("test"));
    expect((await provider.trainers.getDocument(document.id))?.content).toEqual(Buffer.from("test"));
    mocks.download.mockImplementation(async () => new Response("evil"));
    await expect(provider.trainers.getDocument(document.id)).rejects.toThrow("integridad");
    expect(await provider.trainers.listDocuments("synthetic-person")).toEqual([expect.not.objectContaining({ sha256: expect.any(String), driveItemId: expect.any(String) })]);
  });
});
