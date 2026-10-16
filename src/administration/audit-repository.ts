import { readDemoJson, writeDemoJson } from "@/demo/demo-data-store";
import type { AuditEvent, AuditEventInput, AuditFilters } from "./types";

export interface AuditEventRepository {
  append(input: AuditEventInput): Promise<AuditEvent>;
  list(filters?: AuditFilters): Promise<AuditEvent[]>;
}

export class InMemoryAuditEventRepository implements AuditEventRepository {
  private events: AuditEvent[];
  constructor(seed?: AuditEvent[], private readonly persist = false) {
    this.events = structuredClone(seed ?? (persist ? readDemoJson<AuditEvent[]>("audit-current.json") : undefined) ?? []);
  }
  private save() { if (this.persist) writeDemoJson("audit-current.json", this.events); }
  async append(input: AuditEventInput) {
    const event: AuditEvent = { ...structuredClone(input), id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    this.events.push(event); this.save(); return structuredClone(event);
  }
  async list(filters: AuditFilters = {}) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200); const offset = Math.max(filters.offset ?? 0, 0);
    const search = filters.search?.trim().toLocaleLowerCase("es");
    return structuredClone(this.events.filter((event) =>
      (!filters.entityType || event.entityType === filters.entityType) && (!filters.action || event.action === filters.action) &&
      (!filters.actorUserId || event.actorUserId === filters.actorUserId) && (!filters.from || event.timestamp >= filters.from) &&
      (!filters.to || event.timestamp <= filters.to) && (!search || event.entityId.toLocaleLowerCase("es").includes(search) || JSON.stringify(event).toLocaleLowerCase("es").includes(search))
    ).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(offset, offset + limit));
  }
}
