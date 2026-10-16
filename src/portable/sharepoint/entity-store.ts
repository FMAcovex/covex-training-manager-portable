import { GraphClient, GraphConflictError, GraphRequestError } from "@/portable/graph/graph-client";
import { readPortableServerConfiguration } from "@/portable/config";
import { portableAccessToken } from "@/portable/auth/server-session";
import { portableListName, type PortableListModel } from "@/portable/sharepoint/schema";

const MAX_PAYLOAD_LENGTH = 55_000;

export type PortableRecord<T> = {
  id: string;
  data: T;
  eTag: string;
  itemId: string;
  uniqueKey?: string;
  parentId?: string;
  year?: number;
  status?: string;
  correlationId?: string;
  updatedAt: string;
};

export type PortableRecordIndexes = {
  uniqueKey?: string;
  parentId?: string;
  year?: number;
  status?: string;
  correlationId?: string;
};

export type PortableQuery = PortableRecordIndexes & { ids?: string[] };

export interface PortableEntityStore {
  list<T>(model: PortableListModel, query?: PortableQuery): Promise<Array<PortableRecord<T>>>;
  get<T>(model: PortableListModel, id: string): Promise<PortableRecord<T> | undefined>;
  findUnique<T>(model: PortableListModel, uniqueKey: string): Promise<PortableRecord<T> | undefined>;
  create<T>(model: PortableListModel, id: string, data: T, indexes?: PortableRecordIndexes): Promise<PortableRecord<T>>;
  update<T>(model: PortableListModel, current: PortableRecord<unknown>, data: T, indexes?: PortableRecordIndexes): Promise<PortableRecord<T>>;
  delete(model: PortableListModel, current: PortableRecord<unknown>): Promise<void>;
}

type GraphList = { id: string; displayName: string };
type GraphItem = {
  id: string;
  eTag?: string;
  lastModifiedDateTime?: string;
  fields?: Record<string, unknown> & { "@odata.etag"?: string };
};

function segment(value: string) { return encodeURIComponent(value); }
function escapeOData(value: string) { return value.replace(/'/g, "''"); }

function fieldsFor<T>(id: string, data: T, indexes: PortableRecordIndexes = {}) {
  const payload = JSON.stringify(data);
  if (payload.length > MAX_PAYLOAD_LENGTH) throw new Error("El registro supera el límite seguro de SharePoint; divide el contenido o archívalo como documento.");
  return {
    Title: id.slice(0, 255),
    CovexId: id,
    CovexUniqueKey: indexes.uniqueKey ?? null,
    CovexParentId: indexes.parentId ?? null,
    CovexYear: indexes.year ?? null,
    CovexStatus: indexes.status ?? null,
    CovexCorrelationId: indexes.correlationId ?? null,
    CovexUpdatedAt: new Date().toISOString(),
    CovexPayload: payload,
  };
}

function fromGraph<T>(item: GraphItem): PortableRecord<T> {
  const fields = item.fields ?? {};
  const id = fields.CovexId;
  const eTag = item.eTag ?? fields["@odata.etag"];
  if (typeof id !== "string" || typeof eTag !== "string" || typeof fields.CovexPayload !== "string") {
    throw new Error("SharePoint devolvió un registro COVEX incompleto.");
  }
  let data: T;
  try { data = JSON.parse(fields.CovexPayload) as T; }
  catch { throw new Error(`El registro ${id} contiene JSON no válido.`); }
  return {
    id,
    data,
    eTag,
    itemId: item.id,
    uniqueKey: typeof fields.CovexUniqueKey === "string" && fields.CovexUniqueKey || undefined,
    parentId: typeof fields.CovexParentId === "string" && fields.CovexParentId || undefined,
    year: typeof fields.CovexYear === "number" ? fields.CovexYear : undefined,
    status: typeof fields.CovexStatus === "string" && fields.CovexStatus || undefined,
    correlationId: typeof fields.CovexCorrelationId === "string" && fields.CovexCorrelationId || undefined,
    updatedAt: typeof fields.CovexUpdatedAt === "string" ? fields.CovexUpdatedAt : item.lastModifiedDateTime ?? "",
  };
}

export class GraphPortableEntityStore implements PortableEntityStore {
  private listIds?: Map<PortableListModel, string>;

  constructor(
    private readonly token: () => Promise<string> = portableAccessToken,
    private readonly configuration = readPortableServerConfiguration(),
  ) {}

  private async graph() { return new GraphClient(await this.token()); }

  private async resolveLists() {
    if (this.listIds) return this.listIds;
    const graph = await this.graph();
    const lists = await graph.paginate<GraphList>(`/sites/${segment(this.configuration.siteId)}/lists?$select=id,displayName&$top=200`);
    const byName = new Map(lists.map((list) => [list.displayName, list.id]));
    const resolved = new Map<PortableListModel, string>();
    const models = (await import("@/portable/sharepoint/schema")).PORTABLE_LIST_SCHEMA.map((item) => item.model);
    for (const model of models) {
      const name = portableListName(model, this.configuration.listPrefix);
      const id = byName.get(name);
      if (!id) throw new Error(`Falta la lista SharePoint ${name}. Ejecuta el aprovisionamiento H10B.`);
      resolved.set(model, id);
    }
    this.listIds = resolved;
    return resolved;
  }

  private async itemsPath(model: PortableListModel) {
    const id = (await this.resolveLists()).get(model)!;
    return `/sites/${segment(this.configuration.siteId)}/lists/${segment(id)}/items`;
  }

  async list<T>(model: PortableListModel, query: PortableQuery = {}) {
    const graph = await this.graph();
    let path = `${await this.itemsPath(model)}?$expand=fields&$top=200`;
    const serverFilter = query.ids?.length === 1
      ? `fields/CovexId eq '${escapeOData(query.ids[0])}'`
      : query.parentId !== undefined
      ? `fields/CovexParentId eq '${escapeOData(query.parentId)}'`
      : query.uniqueKey !== undefined
        ? `fields/CovexUniqueKey eq '${escapeOData(query.uniqueKey)}'`
        : undefined;
    if (serverFilter) path += `&$filter=${encodeURIComponent(serverFilter)}`;
    const records = (await graph.paginate<GraphItem>(path)).map(fromGraph<T>);
    const ids = query.ids ? new Set(query.ids) : undefined;
    return records.filter((item) =>
      (!ids || ids.has(item.id))
      && (query.uniqueKey === undefined || item.uniqueKey === query.uniqueKey)
      && (query.parentId === undefined || item.parentId === query.parentId)
      && (query.year === undefined || item.year === query.year)
      && (query.status === undefined || item.status === query.status)
      && (query.correlationId === undefined || item.correlationId === query.correlationId));
  }

  async get<T>(model: PortableListModel, id: string) {
    const records = await this.list<T>(model, { ids: [id] });
    return records.find((item) => item.id === id);
  }

  async findUnique<T>(model: PortableListModel, uniqueKey: string) {
    const records = await this.list<T>(model, { uniqueKey });
    if (records.length > 1) throw new Error(`La clave única ${model}/${uniqueKey} está duplicada en SharePoint.`);
    return records[0];
  }

  async create<T>(model: PortableListModel, id: string, data: T, indexes: PortableRecordIndexes = {}) {
    const graph = await this.graph();
    try {
      await graph.requestJson<GraphItem>(await this.itemsPath(model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: fieldsFor(id, data, indexes) }),
      });
    } catch (error) {
      if (error instanceof GraphRequestError && (error.status === 400 || error.status === 409)) throw new GraphConflictError("El registro o su clave única ya existen en SharePoint.");
      throw error;
    }
    const created = await this.get<T>(model, id);
    if (!created) throw new Error(`SharePoint no devolvió el registro ${model}/${id} recién creado.`);
    return created;
  }

  async update<T>(model: PortableListModel, current: PortableRecord<unknown>, data: T, indexes: PortableRecordIndexes = {}) {
    const graph = await this.graph();
    const path = `${await this.itemsPath(model)}/${segment(current.itemId)}/fields`;
    try {
      await graph.request(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "If-Match": current.eTag },
        body: JSON.stringify(fieldsFor(current.id, data, indexes)),
      });
    } catch (error) {
      if (error instanceof GraphRequestError && (error.status === 400 || error.status === 409)) throw new GraphConflictError("La clave única ya existe en SharePoint.");
      throw error;
    }
    const updated = await this.get<T>(model, current.id);
    if (!updated) throw new Error(`SharePoint no devolvió el registro ${model}/${current.id} actualizado.`);
    return updated;
  }

  async delete(model: PortableListModel, current: PortableRecord<unknown>) {
    const graph = await this.graph();
    const path = `${await this.itemsPath(model)}/${segment(current.itemId)}`;
    const response = await graph.request(path, { method: "DELETE", headers: { "If-Match": current.eTag } });
    if (response.status !== 204 && !response.ok) throw new GraphConflictError();
  }
}

export class InMemoryPortableEntityStore implements PortableEntityStore {
  private readonly records = new Map<PortableListModel, Map<string, PortableRecord<unknown>>>();
  private version = 0;
  private rows(model: PortableListModel) {
    let rows = this.records.get(model);
    if (!rows) { rows = new Map(); this.records.set(model, rows); }
    return rows;
  }
  async list<T>(model: PortableListModel, query: PortableQuery = {}) {
    const ids = query.ids ? new Set(query.ids) : undefined;
    return structuredClone([...this.rows(model).values()].filter((item) =>
      (!ids || ids.has(item.id))
      && (query.uniqueKey === undefined || item.uniqueKey === query.uniqueKey)
      && (query.parentId === undefined || item.parentId === query.parentId)
      && (query.year === undefined || item.year === query.year)
      && (query.status === undefined || item.status === query.status)
      && (query.correlationId === undefined || item.correlationId === query.correlationId))) as Array<PortableRecord<T>>;
  }
  async get<T>(model: PortableListModel, id: string) { return (await this.list<T>(model)).find((item) => item.id === id); }
  async findUnique<T>(model: PortableListModel, uniqueKey: string) {
    const found = await this.list<T>(model, { uniqueKey });
    if (found.length > 1) throw new Error("Clave única duplicada");
    return found[0];
  }
  async create<T>(model: PortableListModel, id: string, data: T, indexes: PortableRecordIndexes = {}) {
    const rows = this.rows(model);
    if (rows.has(id) || (indexes.uniqueKey && [...rows.values()].some((item) => item.uniqueKey === indexes.uniqueKey))) {
      throw new GraphConflictError("El registro o su clave única ya existen.");
    }
    const record: PortableRecord<T> = { id, data: structuredClone(data), itemId: `item-${++this.version}`, eTag: `\"${this.version}\"`, updatedAt: new Date().toISOString(), ...indexes };
    rows.set(id, record as PortableRecord<unknown>);
    return structuredClone(record);
  }
  async update<T>(model: PortableListModel, current: PortableRecord<unknown>, data: T, indexes: PortableRecordIndexes = {}) {
    const rows = this.rows(model); const stored = rows.get(current.id);
    if (!stored || stored.eTag !== current.eTag) throw new GraphConflictError();
    if (indexes.uniqueKey && [...rows.values()].some((item) => item.id !== current.id && item.uniqueKey === indexes.uniqueKey)) throw new GraphConflictError("La clave única ya existe.");
    const record: PortableRecord<T> = { id: current.id, data: structuredClone(data), itemId: current.itemId, eTag: `\"${++this.version}\"`, updatedAt: new Date().toISOString(), ...indexes };
    rows.set(current.id, record as PortableRecord<unknown>); return structuredClone(record);
  }
  async delete(model: PortableListModel, current: PortableRecord<unknown>) {
    const rows = this.rows(model); const stored = rows.get(current.id);
    if (!stored || stored.eTag !== current.eTag) throw new GraphConflictError();
    rows.delete(current.id);
  }
}
