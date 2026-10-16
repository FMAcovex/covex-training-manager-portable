import { describe, expect, it, vi } from "vitest";
import { GraphConflictError } from "@/portable/graph/graph-client";
import { InMemoryPortableEntityStore } from "./entity-store";
import { PORTABLE_WRITE_LOCK_ID, PortableWriteCoordinator } from "./write-coordinator";
import { PortablePartialWriteError } from "./unit-of-work";
import { createPortableProvider } from "./provider";

describe("portable coordinated writes", () => {
  it("serializes two independent installations and permits a later explicit retry", async () => {
    const store = new InMemoryPortableEntityStore();
    const first = new PortableWriteCoordinator(store);
    const second = new PortableWriteCoordinator(store);
    let started!: () => void; let finish!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const continueWrite = new Promise<void>((resolve) => { finish = resolve; });
    const writing = first.execute("first-client", async () => {
      await first.store.create("Person", "first", { id: "first" }); started(); await continueWrite;
    });
    await ready;
    await expect(second.execute("second-client", async () => undefined)).rejects.toBeInstanceOf(GraphConflictError);
    finish(); await writing;
    await expect(second.execute("second-client-retry", () => second.store.create("Person", "second", { id: "second" }))).resolves.toMatchObject({ id: "second" });
    expect(await store.list("Person")).toHaveLength(2);
  });

  it("persists the affected record IDs and blocks future writes after audit failure", async () => {
    const raw = new InMemoryPortableEntityStore();
    const originalCreate = raw.create.bind(raw);
    vi.spyOn(raw, "create").mockImplementation(async (model, ...args) => {
      if (model === "AuditEvent") throw new Error("synthetic disconnected audit");
      return originalCreate(model, ...args);
    });
    const first = createPortableProvider(raw);
    await expect(first.people.create({ fullName: "Sintético", employeeCode: "SYN", personType: "INTERNAL", jobTitle: "Test" }, "actor")).rejects.toBeInstanceOf(PortablePartialWriteError);
    const lock = await raw.get<{ state: string; operationId: string }>("CovexOperation", PORTABLE_WRITE_LOCK_ID);
    expect(lock?.data.state).toBe("NEEDS_RECONCILIATION");
    const operation = await raw.get<{ state: string; targets: unknown[] }>("CovexOperation", lock!.data.operationId);
    expect(operation?.data).toMatchObject({ state: "NEEDS_RECONCILIATION", targets: expect.arrayContaining([expect.objectContaining({ model: "Person", action: "create" }), expect.objectContaining({ model: "AuditEvent", action: "create" })]) });
    const anotherInstallation = createPortableProvider(raw);
    await expect(anotherInstallation.people.create({ fullName: "Segundo", personType: "INTERNAL", jobTitle: "Test" }, "actor")).rejects.toBeInstanceOf(PortablePartialWriteError);
  });

  it("releases the lock when validation rejects before touching business data", async () => {
    const raw = new InMemoryPortableEntityStore(); const writes = new PortableWriteCoordinator(raw);
    await expect(writes.execute("invalid-input", async () => { throw new Error("validation"); })).rejects.toThrow("validation");
    expect(await raw.get("CovexOperation", PORTABLE_WRITE_LOCK_ID)).toMatchObject({ data: { state: "FREE" } });
    await expect(writes.execute("valid-input", () => writes.store.create("Person", "ok", { id: "ok" }))).resolves.toMatchObject({ id: "ok" });
  });

  it("does not expire a lock abandoned by another process", async () => {
    const raw = new InMemoryPortableEntityStore();
    await raw.create("CovexOperation", PORTABLE_WRITE_LOCK_ID, { state: "HELD", operationId: "crashed-client" }, { uniqueKey: PORTABLE_WRITE_LOCK_ID });
    await expect(new PortableWriteCoordinator(raw).execute("new-process", async () => undefined)).rejects.toThrow("reconciliación");
  });

  it("requires a durable journal before attempting business writes", async () => {
    const raw = new InMemoryPortableEntityStore(); const writes = new PortableWriteCoordinator(raw);
    await expect(writes.store.create("Person", "untracked", { id: "untracked" })).rejects.toThrow("coordinada");
    expect(await raw.list("Person")).toHaveLength(0);
  });

  it("segments a large import journal instead of exceeding the SharePoint text limit", async () => {
    const raw = new InMemoryPortableEntityStore(); const writes = new PortableWriteCoordinator(raw);
    await writes.execute("synthetic-bulk", async () => {
      for (let index = 0; index < 205; index += 1) await writes.store.create("Person", `synthetic-${index}`, { id: `synthetic-${index}` });
    });
    const operations = await raw.list<{ kind?: string; state: string; targetCount?: number; targets: unknown[]; segments?: string[] }>("CovexOperation");
    expect(operations.find((item) => item.data.kind === "synthetic-bulk")?.data).toMatchObject({ state: "COMMITTED", targetCount: 205, targets: expect.any(Array), segments: expect.any(Array) });
    expect(operations.filter((item) => item.data.state === "DETAIL").map((item) => item.data.targets.length)).toEqual([100, 100]);
  });
});
