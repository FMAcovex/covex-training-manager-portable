import type { CurrentUser } from "@/auth/current-user";
import type { PeopleRepository } from "@/server/people-repository";
import type { TrainingRepository } from "@/server/training-repository";
import type { AuditEventRepository } from "./audit-repository";
import { getDemoCatalogStore, listForKind, persistDemoCatalogStore, type DemoCatalogStore } from "./demo-catalog-store";
import { AdminConflictError, type AdminCatalogItem, type CatalogCreateInput, type CatalogKind, type CatalogUpdateInput } from "./types";

export interface CatalogAdminRepository {
  list(kind: CatalogKind): Promise<AdminCatalogItem[]>;
  create(kind: CatalogKind, input: CatalogCreateInput, actor: CurrentUser): Promise<AdminCatalogItem>;
  update(kind: CatalogKind, id: string, input: CatalogUpdateInput, actor: CurrentUser): Promise<AdminCatalogItem | undefined>;
}

export class InMemoryCatalogAdminRepository implements CatalogAdminRepository {
  constructor(
    private readonly audit: AuditEventRepository,
    private readonly trainings: TrainingRepository,
    private readonly people: PeopleRepository,
    private readonly store: DemoCatalogStore = getDemoCatalogStore(),
    private readonly persist = false,
  ) {}
  private async referenced(kind: CatalogKind, id: string) {
    if (kind === "departments") return (await this.people.list()).some((item) => item.departmentId === id);
    const field = kind === "training-types" ? "trainingTypeId" : kind === "modalities" ? "modalityId" : "evaluationMethodId";
    return (await this.trainings.list()).some((item) => item[field] === id);
  }
  async list(kind: CatalogKind) { return Promise.all(listForKind(this.store, kind).map(async (item) => ({ ...structuredClone(item), referenced: await this.referenced(kind, item.id) }))); }
  async create(kind: CatalogKind, input: CatalogCreateInput, actor: CurrentUser) {
    const rows = listForKind(this.store, kind); if (rows.some((item) => item.code.toLocaleLowerCase() === input.code.toLocaleLowerCase())) throw new AdminConflictError("El código ya existe");
    const item = { ...input, id: crypto.randomUUID(), referenced: false }; await this.audit.append({ actorUserId: actor.id, entityType: "CATALOG", entityId: item.id, action: "CATALOG_CREATED", afterJson: item, contextJson: { kind } }); rows.push(item); if (this.persist) persistDemoCatalogStore(this.store); return structuredClone(item);
  }
  async update(kind: CatalogKind, id: string, input: CatalogUpdateInput, actor: CurrentUser) {
    const rows = listForKind(this.store, kind); const index = rows.findIndex((item) => item.id === id); if (index < 0) return undefined; const before = { ...rows[index], referenced: await this.referenced(kind, id) };
    if (input.name !== undefined && input.name !== before.name && before.referenced) throw new AdminConflictError("El elemento está referenciado históricamente. Desactívelo y cree uno nuevo para preservar la trazabilidad.");
    const after = { ...before, ...input }; const action = before.active !== after.active ? (after.active ? "CATALOG_ACTIVATED" : "CATALOG_DEACTIVATED") : "CATALOG_UPDATED";
    await this.audit.append({ actorUserId: actor.id, entityType: "CATALOG", entityId: id, action, beforeJson: before, afterJson: after, contextJson: { kind } }); rows[index] = { id: after.id, code: after.code, name: after.name, active: after.active }; if (this.persist) persistDemoCatalogStore(this.store); return structuredClone(after);
  }
}
