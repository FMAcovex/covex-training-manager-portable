import { describe, expect, it, vi } from "vitest";
import { SharePointTrainingRepository, type PortableTrainingInput } from "./training-repository";

const input: PortableTrainingInput = {
  code: "FOR-2026-POC1",
  year: 2026,
  name: "Formación ficticia H10A",
  planningType: "UNPLANNED",
  reason: "Prueba simulada",
  isGmp: false,
  originType: "INTERNAL",
};

const item = {
  id: "7",
  eTag: '"etag-7,1"',
  lastModifiedDateTime: "2026-10-16T12:00:00Z",
  fields: {
    Title: input.name,
    CovexCode: input.code,
    CovexYear: input.year,
    PlanningType: input.planningType,
    Reason: input.reason,
    IsGmp: input.isGmp,
    OriginType: input.originType,
  },
};

describe("SharePointTrainingRepository", () => {
  it("creates and reads a Training list item", async () => {
    const graph = { requestJson: vi.fn().mockResolvedValue(item), paginate: vi.fn() };
    const repository = new SharePointTrainingRepository(graph, "site", "list");

    await expect(repository.create(input)).resolves.toMatchObject({ id: "7", eTag: '"etag-7,1"', ...input });
    expect(graph.requestJson).toHaveBeenCalledWith("/sites/site/lists/list/items", expect.objectContaining({ method: "POST" }));
  });

  it("lists paginated items", async () => {
    const graph = { requestJson: vi.fn(), paginate: vi.fn().mockResolvedValue([item]) };
    const repository = new SharePointTrainingRepository(graph, "site", "list");
    await expect(repository.list()).resolves.toEqual([expect.objectContaining({ id: "7", name: input.name })]);
  });

  it("updates with the exact ETag and reloads the item", async () => {
    const updated = { ...item, eTag: '"etag-7,2"', fields: { ...item.fields, Title: "Formación actualizada" } };
    const graph = { requestJson: vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce(updated), paginate: vi.fn() };
    const repository = new SharePointTrainingRepository(graph, "site", "list");

    await expect(repository.update("7", { ...input, name: "Formación actualizada" }, '"etag-7,1"')).resolves.toMatchObject({ name: "Formación actualizada", eTag: '"etag-7,2"' });
    expect(graph.requestJson.mock.calls[0][1]).toMatchObject({ method: "PATCH", headers: { "Content-Type": "application/json", "If-Match": '"etag-7,1"' } });
  });

  it("preserves the mandatory reason rule", async () => {
    const graph = { requestJson: vi.fn(), paginate: vi.fn() };
    const repository = new SharePointTrainingRepository(graph, "site", "list");
    await expect(repository.create({ ...input, reason: "" })).rejects.toThrow("motivo");
    expect(graph.requestJson).not.toHaveBeenCalled();
  });
});
