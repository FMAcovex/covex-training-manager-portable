import type { AuditEventRepository } from "@/administration/audit-repository";
import type { AuditEvent, AuditEventInput, AuditFilters } from "@/administration/types";
import { InMemoryAuditEventRepository } from "@/administration/audit-repository";
import type { CurrentUser } from "@/auth/current-user";
import type { Department } from "@/domain/department";
import type { Person, PersonInput } from "@/domain/person";
import { formatSessionCode, type FinalizeSessionInput, type NotExecutedInput, type SessionInput, type TrainingGlobalStatus, type TrainingSession } from "@/domain/training-session";
import { formatTrainingCode, matchesTrainingFilters, type Training, type TrainingFilters, type TrainingInput } from "@/domain/training";
import type { TrainingCatalogs } from "@/domain/training-catalogs";
import { GraphConflictError } from "@/portable/graph/graph-client";
import type { PortableEntityStore, PortableRecord } from "@/portable/sharepoint/entity-store";
import { PortableUnitOfWork } from "@/portable/sharepoint/unit-of-work";
import { PeopleDepartmentReferenceError, type PeopleRepository } from "@/server/people-repository";
import { InMemorySessionRepository, type HistoricalSessionImportInput, type SessionRepository } from "@/server/session-repository";
import { TrainingCatalogReferenceError, TrainingClosureError, TrainingConflictError, TrainingYearImmutableError, type TrainingRepository } from "@/server/training-repository";

const clone = <T>(value: T): T => structuredClone(value);
const idFor = (left: string, right: string) => `${left}:${right}`;

export class PortableAuditEventRepository implements AuditEventRepository {
  constructor(private readonly store: PortableEntityStore) {}

  async append(input: AuditEventInput) {
    const event: AuditEvent = { ...clone(input), id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    await this.store.create("AuditEvent", event.id, event, {
      parentId: event.entityId,
      status: event.action,
      correlationId: typeof event.contextJson === "object" && event.contextJson && "correlationId" in event.contextJson
        ? String((event.contextJson as { correlationId?: unknown }).correlationId ?? "") || undefined
        : undefined,
    });
    return clone(event);
  }

  async list(filters: AuditFilters = {}) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);
    const search = filters.search?.trim().toLocaleLowerCase("es");
    return (await this.store.list<AuditEvent>("AuditEvent"))
      .map((item) => item.data)
      .filter((event) => (!filters.entityType || event.entityType === filters.entityType)
        && (!filters.action || event.action === filters.action)
        && (!filters.actorUserId || event.actorUserId === filters.actorUserId)
        && (!filters.from || event.timestamp >= filters.from)
        && (!filters.to || event.timestamp <= filters.to)
        && (!search || event.entityId.toLocaleLowerCase("es").includes(search) || JSON.stringify(event).toLocaleLowerCase("es").includes(search)))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(offset, offset + limit)
      .map(clone);
  }
}

export class PortablePeopleRepository implements PeopleRepository {
  constructor(private readonly store: PortableEntityStore, private readonly audit: AuditEventRepository) {}

  async list() { return (await this.store.list<Person>("Person")).map((item) => clone(item.data)); }
  async findById(id: string) { return clone((await this.store.get<Person>("Person", id))?.data); }

  private async validateDepartment(input: PersonInput, existing?: Person) {
    if (!input.departmentId) return;
    const department = await this.store.get<Department>("Department", input.departmentId);
    if (!department || (!department.data.active && input.departmentId !== existing?.departmentId)) {
      throw new PeopleDepartmentReferenceError("El departamento seleccionado no existe o está inactivo");
    }
  }

  async create(input: PersonInput, actorUserId?: string) {
    await this.validateDepartment(input);
    const person: Person = { ...clone(input), id: crypto.randomUUID(), active: true };
    let created: PortableRecord<Person> | undefined;
    await new PortableUnitOfWork(this.store).execute("PERSON_CREATE", [
      { name: "person", execute: async () => { created = await this.store.create("Person", person.id, person, { uniqueKey: person.employeeCode || undefined, status: "ACTIVE" }); }, compensate: async () => { if (created) await this.store.delete("Person", created); } },
      { name: "audit", execute: async () => { if (actorUserId) await this.audit.append({ actorUserId, entityType: "PERSON", entityId: person.id, action: "PERSON_CREATED", afterJson: person }); } },
    ]);
    return clone(person);
  }

  async rollbackCreated(id: string) { const row = await this.store.get("Person", id); if (row) await this.store.delete("Person", row); }

  async update(id: string, input: PersonInput, actorUserId?: string) {
    const current = await this.store.get<Person>("Person", id);
    if (!current) return undefined;
    await this.validateDepartment(input, current.data);
    const updated = { ...current.data, ...clone(input) };
    await this.store.update("Person", current, updated, { uniqueKey: updated.employeeCode || undefined, status: updated.active ? "ACTIVE" : "INACTIVE" });
    if (actorUserId) await this.audit.append({ actorUserId, entityType: "PERSON", entityId: id, action: "PERSON_UPDATED", beforeJson: current.data, afterJson: updated });
    return clone(updated);
  }

  private async setActive(id: string, active: boolean, actorUserId?: string) {
    const current = await this.store.get<Person>("Person", id);
    if (!current) return undefined;
    const updated = { ...current.data, active };
    await this.store.update("Person", current, updated, { uniqueKey: updated.employeeCode || undefined, status: active ? "ACTIVE" : "INACTIVE" });
    if (actorUserId) await this.audit.append({ actorUserId, entityType: "PERSON", entityId: id, action: active ? "PERSON_ACTIVATED" : "PERSON_DEACTIVATED", beforeJson: current.data, afterJson: updated });
    return clone(updated);
  }

  activate(id: string, actorUserId?: string) { return this.setActive(id, true, actorUserId); }
  deactivate(id: string, actorUserId?: string) { return this.setActive(id, false, actorUserId); }
  async listDepartments(options?: { includeInactive?: boolean }) {
    const rows = (await this.store.list<Department>("Department")).map((item) => item.data);
    return clone(options?.includeInactive ? rows : rows.filter((item) => item.active));
  }
}

type SequenceData = { scope: string; lastValue: number; updatedAt: string };

async function reserveSequence(store: PortableEntityStore, model: "TrainingCodeSequence" | "SessionCodeSequence", scope: string, maximum: number) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const current = await store.findUnique<SequenceData>(model, scope);
    const next = (current?.data.lastValue ?? 0) + 1;
    if (next > maximum) throw new Error(`La numeración ${scope} ha alcanzado su límite.`);
    try {
      const data = { scope, lastValue: next, updatedAt: new Date().toISOString() };
      if (current) await store.update(model, current, data, { uniqueKey: scope });
      else await store.create(model, crypto.randomUUID(), data, { uniqueKey: scope });
      return next;
    } catch (error) {
      if (!(error instanceof GraphConflictError) || attempt === 11) throw error;
    }
  }
  throw new Error(`No se pudo reservar la numeración ${scope}.`);
}

async function catalogs(store: PortableEntityStore): Promise<TrainingCatalogs & { departments: Department[] }> {
  const [trainingTypes, modalities, evaluationMethods, departments] = await Promise.all([
    store.list<TrainingCatalogs["trainingTypes"][number]>("TrainingType"),
    store.list<TrainingCatalogs["modalities"][number]>("Modality"),
    store.list<TrainingCatalogs["evaluationMethods"][number]>("EvaluationMethod"),
    store.list<Department>("Department"),
  ]);
  return { trainingTypes: trainingTypes.map((x) => x.data), modalities: modalities.map((x) => x.data), evaluationMethods: evaluationMethods.map((x) => x.data), departments: departments.map((x) => x.data) };
}

export class PortableTrainingRepository implements TrainingRepository {
  constructor(private readonly store: PortableEntityStore, private readonly audit: AuditEventRepository, private readonly historicalReferences: () => boolean = () => false) {}

  async list(filters: TrainingFilters = {}) {
    return (await this.store.list<Training>("Training"))
      .map((item) => item.data)
      .filter((item) => matchesTrainingFilters(item, filters))
      .sort((a, b) => b.code.localeCompare(a.code)).map(clone);
  }
  async findById(id: string) { return clone((await this.store.get<Training>("Training", id))?.data); }
  async findByIds(ids: string[]) { const wanted = new Set(ids); return (await this.list()).filter((item) => wanted.has(item.id)); }

  private async validate(input: TrainingInput, existing?: Training) {
    if (existing && input.year !== existing.year) throw new TrainingYearImmutableError();
    const refs = await catalogs(this.store);
    const references = [
      ["tipo de formación", input.trainingTypeId, existing?.trainingTypeId, refs.trainingTypes],
      ["modalidad", input.modalityId, existing?.modalityId, refs.modalities],
      ["método de evaluación", input.evaluationMethodId, existing?.evaluationMethodId, refs.evaluationMethods],
    ] as const;
    for (const [label, requested, prior, rows] of references) {
      if (!requested) continue;
      const row = rows.find((item) => item.id === requested);
      if (!row || (!row.active && requested !== prior)) throw new TrainingCatalogReferenceError(`El ${label} seleccionado no existe o está inactivo`);
    }
    const previousDepartments = new Set(existing?.targetDepartmentIds ?? []);
    for (const departmentId of new Set(input.targetDepartmentIds ?? [])) {
      const department = refs.departments.find((item) => item.id === departmentId);
      if (!department || (!department.active && !previousDepartments.has(departmentId))) throw new TrainingCatalogReferenceError("Todos los departamentos destinatarios deben existir y estar activos");
    }
    const previousTrainers = new Set(existing?.plannedTrainerPersonIds ?? (existing?.plannedTrainerPersonId ? [existing.plannedTrainerPersonId] : []));
    for (const personId of new Set(input.plannedTrainerPersonIds ?? (input.plannedTrainerPersonId ? [input.plannedTrainerPersonId] : []))) {
      const trainer = await this.store.get<Person>("Person", personId);
      if (!trainer || (!trainer.data.active && !previousTrainers.has(personId) && !this.historicalReferences())) throw new TrainingCatalogReferenceError("Todos los formadores deben existir y estar activos");
    }
  }

  private async syncLinks(training: Training) {
    const desiredTrainers = new Set(training.plannedTrainerPersonIds ?? (training.plannedTrainerPersonId ? [training.plannedTrainerPersonId] : []));
    const desiredDepartments = new Set(training.targetDepartmentIds ?? []);
    await this.syncLinkModel("TrainingPlannedTrainer", training.id, desiredTrainers, "personId");
    await this.syncLinkModel("TrainingTargetDepartment", training.id, desiredDepartments, "departmentId");
  }

  private async syncLinkModel(model: "TrainingPlannedTrainer" | "TrainingTargetDepartment", trainingId: string, desired: Set<string>, key: "personId" | "departmentId") {
    const rows = await this.store.list<Record<string, string>>(model, { parentId: trainingId });
    for (const row of rows) if (!desired.has(row.data[key])) await this.store.delete(model, row);
    const existing = new Set(rows.map((row) => row.data[key]));
    for (const value of desired) if (!existing.has(value)) {
      const id = idFor(trainingId, value);
      await this.store.create(model, id, { id, trainingId, [key]: value }, { parentId: trainingId, uniqueKey: id });
    }
  }

  async create(input: TrainingInput, createdByUserId: string) {
    await this.validate(input);
    const sequence = await reserveSequence(this.store, "TrainingCodeSequence", String(input.year), 9999);
    const timestamp = new Date().toISOString();
    const training: Training = { ...clone(input), id: crypto.randomUUID(), code: formatTrainingCode(input.year, sequence), createdByUserId, createdAt: timestamp, updatedAt: timestamp };
    let created: PortableRecord<Training> | undefined;
    await new PortableUnitOfWork(this.store).execute("TRAINING_CREATE", [
      { name: "training", execute: async () => { created = await this.store.create("Training", training.id, training, { uniqueKey: training.code, year: training.year, status: "OPEN" }); }, compensate: async () => { if (created) await this.store.delete("Training", created); } },
      { name: "relations", execute: () => this.syncLinks(training), compensate: async () => {
        for (const model of ["TrainingPlannedTrainer", "TrainingTargetDepartment"] as const) {
          for (const row of await this.store.list(model, { parentId: training.id })) await this.store.delete(model, row);
        }
      } },
      { name: "audit", execute: async () => { await this.audit.append({ actorUserId: createdByUserId, entityType: "TRAINING", entityId: training.id, action: "TRAINING_CREATED", afterJson: training, contextJson: { code: training.code } }); } },
    ], { idempotencyKey: `training-create:${training.id}` });
    return clone(training);
  }

  async update(id: string, input: TrainingInput, actorUserId: string, expectedUpdatedAt?: string) {
    const current = await this.store.get<Training>("Training", id);
    if (!current) return undefined;
    if (expectedUpdatedAt && current.data.updatedAt !== expectedUpdatedAt) throw new TrainingConflictError();
    await this.validate(input, current.data);
    const updatedAt = new Date(Math.max(Date.now(), Date.parse(current.data.updatedAt) + 1)).toISOString();
    const updated = { ...current.data, ...clone(input), updatedAt };
    await this.store.update("Training", current, updated, { uniqueKey: updated.code, year: updated.year, status: updated.closedAt ? "CLOSED" : "OPEN" });
    await this.syncLinks(updated);
    await this.audit.append({ actorUserId, entityType: "TRAINING", entityId: id, action: "TRAINING_UPDATED", beforeJson: current.data, afterJson: updated, contextJson: { code: updated.code } });
    return clone(updated);
  }

  async closeDocumentary(id: string, actorUserId: string) {
    const current = await this.store.get<Training>("Training", id);
    if (!current) return undefined;
    if (current.data.closedAt) throw new TrainingClosureError("La formación ya está cerrada");
    const updated = { ...current.data, closedAt: new Date().toISOString(), closedByUserId: actorUserId, updatedAt: new Date().toISOString() };
    await this.store.update("Training", current, updated, { uniqueKey: updated.code, year: updated.year, status: "CLOSED" });
    await this.audit.append({ actorUserId, entityType: "TRAINING", entityId: id, action: "TRAINING_DOCUMENTARY_CLOSED", beforeJson: current.data, afterJson: updated });
    return clone(updated);
  }

  async reopenDocumentary(id: string, reason: string, actorUserId: string) {
    const current = await this.store.get<Training>("Training", id);
    if (!current) return undefined;
    if (!current.data.closedAt) throw new TrainingClosureError("La formación ya está abierta");
    const updated = { ...current.data, closedAt: undefined, closedByUserId: undefined, updatedAt: new Date().toISOString() };
    await this.store.update("Training", current, updated, { uniqueKey: updated.code, year: updated.year, status: "OPEN" });
    await this.audit.append({ actorUserId, entityType: "TRAINING", entityId: id, action: "TRAINING_DOCUMENTARY_REOPENED", beforeJson: current.data, afterJson: updated, contextJson: { reason } });
    return clone(updated);
  }

  async listCatalogs(options?: { includeInactive?: boolean }) {
    const all = await catalogs(this.store);
    const visible = <T extends { active: boolean }>(rows: T[]) => options?.includeInactive ? rows : rows.filter((item) => item.active);
    return clone({ trainingTypes: visible(all.trainingTypes), modalities: visible(all.modalities), evaluationMethods: visible(all.evaluationMethods) });
  }
}

export class PortableSessionRepository implements SessionRepository {
  constructor(
    private readonly store: PortableEntityStore,
    private readonly trainings: TrainingRepository,
    private readonly people: PeopleRepository,
    private readonly audit: AuditEventRepository,
  ) {}

  async listAll() { return (await this.store.list<TrainingSession>("TrainingSession")).map((item) => clone(item.data)); }
  async listByTraining(trainingId: string) { return (await this.store.list<TrainingSession>("TrainingSession", { parentId: trainingId })).map((x) => clone(x.data)).sort((a, b) => a.code.localeCompare(b.code)); }
  async listByTrainingIds(trainingIds: string[]) { const ids = new Set(trainingIds); return (await this.listAll()).filter((item) => ids.has(item.trainingId)).sort((a, b) => a.code.localeCompare(b.code)); }
  async listByPerson(personId: string) { return (await this.listAll()).filter((item) => item.attendances.some((attendance) => attendance.personId === personId)); }
  async findById(id: string) { return clone((await this.store.get<TrainingSession>("TrainingSession", id))?.data); }
  async trainingStatus(trainingId: string): Promise<TrainingGlobalStatus> { const { calculateTrainingStatus } = await import("@/domain/training-session"); return calculateTrainingStatus(await this.listByTraining(trainingId)); }

  private async engine() { return new InMemorySessionRepository(this.trainings, this.people, await this.listAll(), new InMemoryAuditEventRepository()); }

  private async persist(session: TrainingSession, current?: PortableRecord<TrainingSession>) {
    let persisted: PortableRecord<TrainingSession> | undefined;
    await new PortableUnitOfWork(this.store).execute(current ? "SESSION_UPDATE" : "SESSION_CREATE", [
      {
        name: "session",
        execute: async () => { persisted = current
          ? await this.store.update("TrainingSession", current, session, { uniqueKey: session.code, parentId: session.trainingId, status: session.executionStatus })
          : await this.store.create("TrainingSession", session.id, session, { uniqueKey: session.code, parentId: session.trainingId, status: session.executionStatus }); },
        compensate: async () => {
          if (!persisted) return;
          if (current) await this.store.update("TrainingSession", persisted, current.data, { uniqueKey: current.data.code, parentId: current.data.trainingId, status: current.data.executionStatus });
          else await this.store.delete("TrainingSession", persisted);
        },
      },
      {
        name: "relations",
        execute: () => this.syncChildren(session),
        compensate: async () => {
          if (current) await this.syncChildren(current.data);
          else for (const model of ["TrainingSessionTrainer", "Attendance"] as const) {
            for (const row of await this.store.list(model, { parentId: session.id })) await this.store.delete(model, row);
          }
        },
      },
    ]);
  }

  private async syncChildren(session: TrainingSession) {
    const trainerIds = new Set(session.trainerPersonIds ?? (session.trainerPersonId ? [session.trainerPersonId] : []));
    const trainers = await this.store.list<{ personId: string }>("TrainingSessionTrainer", { parentId: session.id });
    for (const row of trainers) if (!trainerIds.has(row.data.personId)) await this.store.delete("TrainingSessionTrainer", row);
    const priorTrainers = new Set(trainers.map((row) => row.data.personId));
    for (const personId of trainerIds) if (!priorTrainers.has(personId)) {
      const id = idFor(session.id, personId); await this.store.create("TrainingSessionTrainer", id, { id, sessionId: session.id, personId }, { uniqueKey: id, parentId: session.id });
    }
    const attendances = await this.store.list<TrainingSession["attendances"][number]>("Attendance", { parentId: session.id });
    const desired = new Map(session.attendances.map((item) => [item.id, item]));
    for (const row of attendances) { const next = desired.get(row.id); if (!next) await this.store.delete("Attendance", row); else { await this.store.update("Attendance", row, next, { parentId: session.id, uniqueKey: idFor(session.id, next.personId), status: next.attendanceStatus }); desired.delete(row.id); } }
    for (const item of desired.values()) await this.store.create("Attendance", item.id, item, { parentId: session.id, uniqueKey: idFor(session.id, item.personId), status: item.attendanceStatus });
  }

  private async saveMutation(id: string, action: string, actor: CurrentUser, mutate: (engine: InMemorySessionRepository) => Promise<TrainingSession | undefined>) {
    const current = await this.store.get<TrainingSession>("TrainingSession", id);
    if (!current) return undefined;
    const updated = await mutate(await this.engine());
    if (!updated) return undefined;
    await this.persist(updated, current);
    await this.audit.append({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action, beforeJson: current.data, afterJson: updated });
    return clone(updated);
  }

  async create(input: SessionInput, actor: CurrentUser) {
    const session = await (await this.engine()).create(input, actor);
    const training = await this.trainings.findById(session.trainingId);
    if (!training) throw new Error("La formación asociada no existe");
    const sequence = await reserveSequence(this.store, "SessionCodeSequence", session.trainingId, 99);
    session.code = formatSessionCode(training.code, sequence);
    await this.persist(session);
    await this.audit.append({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: session.id, action: "TRAINING_SESSION_CREATED", afterJson: session, contextJson: { trainingId: session.trainingId, code: session.code } });
    return clone(session);
  }

  update(id: string, input: SessionInput, actor: CurrentUser) { return this.saveMutation(id, "TRAINING_SESSION_UPDATED", actor, (engine) => engine.update(id, input, actor)); }
  finalize(id: string, input: FinalizeSessionInput, actor: CurrentUser) { return this.saveMutation(id, "TRAINING_SESSION_EXECUTED", actor, (engine) => engine.finalize(id, input, actor)); }
  markNotExecuted(id: string, input: NotExecutedInput, actor: CurrentUser) { return this.saveMutation(id, "TRAINING_SESSION_NOT_EXECUTED", actor, (engine) => engine.markNotExecuted(id, input, actor)); }
  reopen(id: string, reason: string, actor: CurrentUser) { return this.saveMutation(id, "TRAINING_SESSION_REOPENED", actor, (engine) => engine.reopen(id, reason, actor)); }

  async importHistorical(input: HistoricalSessionImportInput, actor: CurrentUser) {
    const session = await (await this.engine()).importHistorical(input, actor);
    const training = await this.trainings.findById(session.trainingId);
    if (!training) throw new Error("La formación asociada no existe");
    session.code = formatSessionCode(training.code, await reserveSequence(this.store, "SessionCodeSequence", session.trainingId, 99));
    await this.persist(session);
    await this.audit.append({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: session.id, action: "TRAINING_SESSION_IMPORTED", afterJson: session });
    return clone(session);
  }
}
