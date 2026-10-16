import type { TrainingCatalogs } from "@/domain/training-catalogs";
import { InMemoryAuditEventRepository, type AuditEventRepository } from "@/administration/audit-repository";
import { getDemoCatalogStore, type DemoCatalogStore } from "@/administration/demo-catalog-store";
import { formatTrainingCode, matchesTrainingFilters, type Training, type TrainingFilters, type TrainingInput } from "@/domain/training";
import { readDemoJson, writeDemoJson } from "@/demo/demo-data-store";

export interface TrainingRepository {
  list(filters?: TrainingFilters): Promise<Training[]>;
  findById(id: string): Promise<Training | undefined>;
  findByIds(ids: string[]): Promise<Training[]>;
  create(input: TrainingInput, createdByUserId: string): Promise<Training>;
  update(id: string, input: TrainingInput, updatedByUserId: string, expectedUpdatedAt?: string): Promise<Training | undefined>;
  closeDocumentary(id: string, actorUserId: string): Promise<Training | undefined>;
  reopenDocumentary(id: string, reason: string, actorUserId: string): Promise<Training | undefined>;
  listCatalogs(options?: { includeInactive?: boolean }): Promise<TrainingCatalogs>;
}

export class TrainingYearImmutableError extends Error {
  constructor() { super("El año de una formación no puede modificarse"); }
}
export class TrainingCatalogReferenceError extends Error {}
export class TrainingConflictError extends Error {
  constructor() { super("La formación ha sido modificada por otro usuario. Recarga la ficha antes de guardar de nuevo."); }
}
export class TrainingClosureError extends Error {}

const now = "2026-01-15T09:00:00.000Z";
const demoTrainings: Training[] = [
  {
    id: "training-demo-1", code: "FOR-2026-0001", year: 2026, name: "Buenas prácticas en zona controlada", planningType: "PLANNED",
    trainingTypeId: "type-quality", isGmp: true, originType: "INTERNAL", modalityId: "mod-in-person", plannedDurationMinutes: 120,
    materialReference: "DOC-DEMO-01", content: "Principios operativos y caso práctico ficticio", targetGroup: "Equipo de demostración",
    plannedTrainerPersonId: "demo-1", externalTrainerName: undefined, evaluationMethodId: "eval-test", aptitudeCriterion: "Resultado mínimo definido antes de la impartición",
    frequencyMonths: 12, notes: "Dato ficticio", createdByUserId: "demo-user", createdAt: now, updatedAt: now,
  },
  {
    id: "training-demo-2", code: "FOR-2026-0002", year: 2026, name: "Actualización técnica de equipo simulado", planningType: "UNPLANNED",
    trainingTypeId: "type-technical", reason: "Actualización de un proceso ficticio", isGmp: false, originType: "EXTERNAL", modalityId: "mod-online",
    plannedDurationMinutes: 90, plannedTrainerPersonId: undefined, externalTrainerName: "Formador externo ficticio", notes: "Dato ficticio", createdByUserId: "demo-user", createdAt: now, updatedAt: now,
  },
  {
    id: "training-demo-3", code: "FOR-2025-0001", year: 2025, name: "Seguridad operativa de demostración", planningType: "PLANNED",
    trainingTypeId: "type-safety", isGmp: false, originType: "INTERNAL", modalityId: "mod-mixed", plannedTrainerPersonId: "demo-1", externalTrainerName: undefined,
    createdByUserId: "demo-user", createdAt: now, updatedAt: now,
  },
  {
    id: "training-demo-4", code: "FOR-2026-0003", year: 2026, name: "Planificada pendiente de programación", planningType: "PLANNED",
    trainingTypeId: "type-safety", isGmp: false, originType: "INTERNAL", modalityId: "mod-in-person", plannedDurationMinutes: 60,
    targetGroup: "Producción", plannedTrainerPersonId: "demo-1", evaluationMethodId: "eval-practical", aptitudeCriterion: "Demostración satisfactoria",
    createdByUserId: "demo-user", createdAt: now, updatedAt: "2026-04-01T10:00:00.000Z",
  },
  {
    id: "training-demo-5", code: "FOR-2026-0004", year: 2026, name: "Taller no planificado ejecutado", planningType: "UNPLANNED",
    trainingTypeId: "type-technical", reason: "Necesidad técnica ficticia sobrevenida", isGmp: false, originType: "EXTERNAL", modalityId: "mod-in-person",
    plannedDurationMinutes: 75, materialReference: "MAT-DEMO-04", externalTrainerName: "Entidad formadora ficticia",
    createdByUserId: "demo-user", createdAt: now, updatedAt: "2026-06-15T10:00:00.000Z",
  },
  {
    id: "training-demo-6", code: "FOR-2026-0005", year: 2026, name: "Necesidad no planificada pendiente", planningType: "UNPLANNED",
    trainingTypeId: "type-quality", reason: "Necesidad ficticia todavía pendiente", isGmp: true, originType: "INTERNAL", modalityId: "mod-in-person",
    plannedDurationMinutes: 60, targetGroup: "Calidad", plannedTrainerPersonId: "demo-1", externalTrainerName: undefined,
    evaluationMethodId: "eval-test", aptitudeCriterion: "Superar prueba ficticia", createdByUserId: "demo-user", createdAt: now, updatedAt: "2026-07-01T10:00:00.000Z",
  },
];

export class InMemoryTrainingRepository implements TrainingRepository {
  private trainings: Training[];

  constructor(
    seed?: Training[],
    private readonly catalogStore: DemoCatalogStore = getDemoCatalogStore(),
    private readonly audit: AuditEventRepository = new InMemoryAuditEventRepository(),
    private readonly persist = false,
  ) {
    const loaded = seed ?? (persist ? readDemoJson<Array<Training & { globalStatus?: unknown }>>("trainings-current.json") : undefined) ?? demoTrainings;
    this.trainings = loaded.map((stored) => {
      const training = structuredClone(stored as Training);
      delete training.globalStatus;
      return training;
    });
  }

  private save() { if (this.persist) writeDemoJson("trainings-current.json", this.trainings); }

  async list(filters: TrainingFilters = {}) {
    return this.trainings.filter((training) => matchesTrainingFilters(training, filters)).sort((a, b) => b.code.localeCompare(a.code));
  }

  async findById(id: string) { return this.trainings.find((training) => training.id === id); }
  async findByIds(ids: string[]) {
    const wanted = new Set(ids);
    return this.trainings.filter((training) => wanted.has(training.id));
  }

  private validateCatalogReferences(input: TrainingInput, existing?: Training) {
    const references = [
      ["tipo de formación", input.trainingTypeId, existing?.trainingTypeId, this.catalogStore.trainingTypes],
      ["modalidad", input.modalityId, existing?.modalityId, this.catalogStore.modalities],
      ["método de evaluación", input.evaluationMethodId, existing?.evaluationMethodId, this.catalogStore.evaluationMethods],
    ] as const;
    for (const [label, requestedId, currentId, items] of references) {
      if (!requestedId) continue;
      const item = items.find((candidate) => candidate.id === requestedId);
      if (!item || (!item.active && requestedId !== currentId)) throw new TrainingCatalogReferenceError(`El ${label} seleccionado no existe o está inactivo`);
    }
  }

  async create(input: TrainingInput, createdByUserId: string) {
    this.validateCatalogReferences(input);
    const lastSequence = this.trainings
      .filter((training) => training.year === input.year)
      .map((training) => Number(training.code.slice(-4)))
      .filter(Number.isInteger)
      .reduce((maximum, sequence) => Math.max(maximum, sequence), 0);
    const timestamp = new Date().toISOString();
    const training: Training = {
      ...input,
      id: crypto.randomUUID(),
      code: formatTrainingCode(input.year, lastSequence + 1),
      createdByUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.audit.append({
      actorUserId: createdByUserId,
      entityType: "TRAINING",
      entityId: training.id,
      action: "TRAINING_CREATED",
      afterJson: training,
      contextJson: { code: training.code },
    });
    this.trainings = [...this.trainings, training];
    this.save();
    return training;
  }

  async update(id: string, input: TrainingInput, updatedByUserId: string, expectedUpdatedAt?: string) {
    const existing = await this.findById(id);
    if (!existing) return undefined;
    if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) throw new TrainingConflictError();
    if (input.year !== existing.year) throw new TrainingYearImmutableError();
    this.validateCatalogReferences(input, existing);
    const previousUpdatedAtMs = Date.parse(existing.updatedAt);
    const nowMs = Date.now();
    const updatedAt = new Date(Number.isNaN(previousUpdatedAtMs) ? nowMs : Math.max(nowMs, previousUpdatedAtMs + 1)).toISOString();
    const updated = { ...existing, ...input, updatedAt };
    await this.audit.append({
      actorUserId: updatedByUserId,
      entityType: "TRAINING",
      entityId: id,
      action: "TRAINING_UPDATED",
      beforeJson: existing,
      afterJson: updated,
      contextJson: { code: existing.code },
    });
    this.trainings = this.trainings.map((training) => training.id === id ? updated : training);
    this.save();
    return updated;
  }

  async closeDocumentary(id: string, actorUserId: string) {
    const existing = await this.findById(id);
    if (!existing) return undefined;
    if (existing.closedAt) throw new TrainingClosureError("La formación ya está cerrada");
    const updated = { ...existing, closedAt: new Date().toISOString(), closedByUserId: actorUserId, updatedAt: new Date().toISOString() };
    await this.audit.append({ actorUserId, entityType: "TRAINING", entityId: id, action: "TRAINING_DOCUMENTARY_CLOSED", beforeJson: existing, afterJson: updated });
    this.trainings = this.trainings.map((item) => item.id === id ? updated : item);
    this.save();
    return structuredClone(updated);
  }

  async reopenDocumentary(id: string, reason: string, actorUserId: string) {
    const existing = await this.findById(id);
    if (!existing) return undefined;
    if (!existing.closedAt) throw new TrainingClosureError("La formación ya está abierta");
    const updated = { ...existing, closedAt: undefined, closedByUserId: undefined, updatedAt: new Date().toISOString() };
    await this.audit.append({ actorUserId, entityType: "TRAINING", entityId: id, action: "TRAINING_DOCUMENTARY_REOPENED", beforeJson: existing, afterJson: updated, contextJson: { reason } });
    this.trainings = this.trainings.map((item) => item.id === id ? updated : item);
    this.save();
    return structuredClone(updated);
  }

  async listCatalogs(options?: { includeInactive?: boolean }) {
    const visible = <T extends { active: boolean }>(items: T[]) => options?.includeInactive ? items : items.filter((item) => item.active);
    return { trainingTypes: visible(this.catalogStore.trainingTypes), modalities: visible(this.catalogStore.modalities), evaluationMethods: visible(this.catalogStore.evaluationMethods) };
  }
}
