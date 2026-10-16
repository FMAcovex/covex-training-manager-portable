import { describe, expect, it } from "vitest";
import { validateTraining } from "@/domain/training";
import type { DemoCatalogStore } from "@/administration/demo-catalog-store";
import { InMemoryTrainingRepository, TrainingCatalogReferenceError } from "./training-repository";

const planned = validateTraining({ year: 2027, name: "Formación ficticia", planningType: "PLANNED", isGmp: false, originType: "INTERNAL" });

describe("TrainingRepository en memoria", () => {
  it("crea, recupera y actualiza una formación", async () => {
    const repository = new InMemoryTrainingRepository([]);
    const created = await repository.create(planned, "user-demo");
    expect(await repository.findById(created.id)).toEqual(created);
    const updated = await repository.update(created.id, { ...planned, name: "Nombre actualizado" }, "editor-demo");
    expect(updated).toMatchObject({ id: created.id, code: created.code, year: created.year, name: "Nombre actualizado", createdByUserId: "user-demo" });
  });

  it("rechaza una edición basada en una versión obsoleta", async () => {
    const repository = new InMemoryTrainingRepository([]);
    const created = await repository.create(planned, "user-demo");
    const first = await repository.update(created.id, { ...planned, name: "Primera edición" }, "editor-a", created.updatedAt);
    await expect(repository.update(created.id, { ...planned, name: "Edición obsoleta" }, "editor-b", created.updatedAt)).rejects.toThrow("modificada por otro usuario");
    expect(await repository.findById(created.id)).toMatchObject({ name: first?.name });
  });

  it("rechaza cambiar el año y conserva año y código originales", async () => {
    const repository = new InMemoryTrainingRepository([]);
    const created = await repository.create(planned, "user-demo");
    await expect(repository.update(created.id, { ...planned, year: 2028 }, "editor-demo")).rejects.toThrow("año");
    expect(await repository.findById(created.id)).toMatchObject({ year: 2027, code: "FOR-2027-0001" });
  });

  it("genera códigos consecutivos y únicos", async () => {
    const repository = new InMemoryTrainingRepository([]);
    const first = await repository.create(planned, "user-demo");
    const second = await repository.create({ ...planned, name: "Otra formación" }, "user-demo");
    expect([first.code, second.code]).toEqual(["FOR-2027-0001", "FOR-2027-0002"]);
    expect(new Set([first.code, second.code])).toHaveLength(2);
  });

  it("mantiene numeración independiente por año", async () => {
    const repository = new InMemoryTrainingRepository([]);
    const firstYear = await repository.create(planned, "user-demo");
    const nextYear = await repository.create({ ...planned, year: 2028 }, "user-demo");
    expect(firstYear.code).toBe("FOR-2027-0001");
    expect(nextYear.code).toBe("FOR-2028-0001");
  });

  it("no publica altas ni ediciones si falla la auditoría", async () => {
    const failingAudit = {
      append: async () => { throw new Error("Auditoría no disponible"); },
      list: async () => [],
    };
    const emptyRepository = new InMemoryTrainingRepository([], undefined, failingAudit);
    await expect(emptyRepository.create(planned, "user-demo")).rejects.toThrow("Auditoría");
    expect(await emptyRepository.list()).toHaveLength(0);

    const existing = { ...planned, id: "training-stable", code: "FOR-2027-0001", createdByUserId: "user-demo", createdAt: "", updatedAt: "" };
    const seededRepository = new InMemoryTrainingRepository([existing], undefined, failingAudit);
    await expect(seededRepository.update(existing.id, { ...planned, name: "Cambio no publicado" }, "editor-demo")).rejects.toThrow("Auditoría");
    expect(await seededRepository.findById(existing.id)).toMatchObject({ name: planned.name });
  });

  it("aplica los filtros principales", async () => {
    const repository = new InMemoryTrainingRepository([]);
    await repository.create({ ...planned, name: "Calidad ficticia", isGmp: true, trainingTypeId: "type-quality" }, "user-demo");
    await repository.create({ ...planned, name: "Seguridad ficticia", originType: "EXTERNAL", externalTrainerName: "Docente demo" }, "user-demo");
    expect(await repository.list({ search: "calidad", isGmp: true, trainingTypeId: "type-quality" })).toHaveLength(1);
    expect(await repository.list({ originType: "EXTERNAL" })).toHaveLength(1);
    expect(await repository.list({ planningType: "UNPLANNED" })).toHaveLength(0);
  });

  it("expone catálogos de demo sin depender de componentes", async () => {
    const catalogs = await new InMemoryTrainingRepository([]).listCatalogs();
    expect(catalogs.trainingTypes.length).toBeGreaterThan(0);
    expect(catalogs.modalities.length).toBeGreaterThan(0);
    expect(catalogs.evaluationMethods.length).toBeGreaterThan(0);
  });

  it("oculta catálogos inactivos por defecto y los conserva para históricos", async () => {
    const store: DemoCatalogStore = {
      trainingTypes: [{ id: "historical-type", code: "HIS", name: "Tipo histórico", active: false }],
      modalities: [{ id: "historical-modality", code: "HMO", name: "Modalidad histórica", active: false }],
      evaluationMethods: [{ id: "historical-method", code: "HEV", name: "Método histórico", active: false }],
      departments: [],
    };
    const repository = new InMemoryTrainingRepository([], store);
    expect((await repository.listCatalogs()).trainingTypes).toHaveLength(0);
    expect((await repository.listCatalogs({ includeInactive: true })).trainingTypes[0]).toMatchObject({ id: "historical-type", active: false });
  });

  it("permite conservar referencias inactivas al editar pero no asignarlas", async () => {
    const store: DemoCatalogStore = {
      trainingTypes: [{ id: "historical-type", code: "HIS", name: "Tipo histórico", active: false }],
      modalities: [{ id: "historical-modality", code: "HMO", name: "Modalidad histórica", active: false }],
      evaluationMethods: [{ id: "historical-method", code: "HEV", name: "Método histórico", active: false }],
      departments: [],
    };
    const historical = { ...planned, trainingTypeId: "historical-type", modalityId: "historical-modality", evaluationMethodId: "historical-method" };
    const repository = new InMemoryTrainingRepository([{ ...historical, id: "historical", code: "FOR-2027-0001", createdByUserId: "user-demo", createdAt: "", updatedAt: "" }], store);
    await expect(repository.update("historical", { ...historical, name: "Nombre corregido" }, "editor-demo")).resolves.toMatchObject({ name: "Nombre corregido" });
    await expect(repository.create(historical, "user-demo")).rejects.toBeInstanceOf(TrainingCatalogReferenceError);
    await expect(repository.update("historical", { ...historical, trainingTypeId: "missing" }, "editor-demo")).rejects.toBeInstanceOf(TrainingCatalogReferenceError);
  });
});
