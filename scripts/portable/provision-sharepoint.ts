import { PORTABLE_LIST_SCHEMA, portableListName } from "../../src/portable/sharepoint/schema";
import { defaultDepartments } from "../../src/administration/demo-catalog-store";
import { demoTrainingCatalogs } from "../../src/domain/training-catalogs";
import { demoAnnexIIITemplate, demoAnnexIVTemplate, demoAnnexVTemplate } from "../../src/annexes/annex-repository";

const dryRun = process.argv.includes("--dry-run");
const seedSynthetic = process.argv.includes("--seed-synthetic");
const siteId = process.env.PORTABLE_SHAREPOINT_SITE_ID?.trim();
const prefix = process.env.PORTABLE_SHAREPOINT_LIST_PREFIX?.trim() || "COVEX";
const token = process.env.PORTABLE_PROVISION_ACCESS_TOKEN?.trim();
const bootstrapObjectId = process.env.PORTABLE_BOOTSTRAP_ADMIN_OBJECT_ID?.trim();
const bootstrapEmail = process.env.PORTABLE_BOOTSTRAP_ADMIN_EMAIL?.trim();
const bootstrapName = process.env.PORTABLE_BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim();

if (!siteId) throw new Error("Define PORTABLE_SHAREPOINT_SITE_ID.");
if (!dryRun && !token) throw new Error("Define PORTABLE_PROVISION_ACCESS_TOKEN solo durante el aprovisionamiento.");
const configuredSiteId = siteId;

const root = "https://graph.microsoft.com/v1.0";
async function graph<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${root}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`El aprovisionamiento recibió HTTP ${response.status} de Graph. Revisa el esquema y los permisos con IT.`);
  return response.status === 204 ? undefined as T : await response.json() as T;
}

type GraphList = { id: string; displayName: string };
type GraphColumn = { id: string; name: string; indexed?: boolean; enforceUniqueValues?: boolean; text?: { allowMultipleLines?: boolean }; number?: unknown; dateTime?: unknown };

async function seedRecord(lists: Map<string, GraphList>, model: string, id: string, uniqueKey: string, status: string, data: unknown) {
  const list = lists.get(`${prefix}-${model}`)!;
  const found = await graph<{ value: Array<{ id: string }> }>(`/sites/${encodeURIComponent(configuredSiteId)}/lists/${encodeURIComponent(list.id)}/items?$expand=fields&$filter=${encodeURIComponent(`fields/CovexId eq '${id.replace(/'/g, "''")}'`)}&$top=2`);
  if (found.value.length) return;
  const now = new Date().toISOString();
  await graph(`/sites/${encodeURIComponent(configuredSiteId)}/lists/${encodeURIComponent(list.id)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { Title: id.slice(0, 255), CovexId: id, CovexUniqueKey: uniqueKey, CovexStatus: status, CovexUpdatedAt: now, CovexPayload: JSON.stringify(data) } }),
  });
}

const columnBody = (name: string, kind: string, indexed?: boolean, unique?: boolean) => ({
  name,
  displayName: name,
  indexed: Boolean(indexed || unique),
  enforceUniqueValues: Boolean(unique),
  ...(kind === "number" ? { number: { decimalPlaces: "none" } }
    : kind === "dateTime" ? { dateTime: { format: "dateTime" } }
      : { text: { allowMultipleLines: kind === "multilineText", appendChangesToExistingText: false, linesForEditing: kind === "multilineText" ? 20 : undefined, maxLength: kind === "multilineText" ? undefined : 255 } }),
});

async function main() {
  console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "apply", siteId: configuredSiteId, prefix, seedSynthetic, lists: PORTABLE_LIST_SCHEMA.map((list) => ({ name: portableListName(list.model, prefix), model: list.model, columns: list.columns })) }, null, 2));

  if (!dryRun) {
  const existing = await graph<{ value: GraphList[] }>(`/sites/${encodeURIComponent(configuredSiteId)}/lists?$select=id,displayName&$top=200`);
  const lists = new Map(existing.value.map((item) => [item.displayName, item]));
  for (const definition of PORTABLE_LIST_SCHEMA) {
    const displayName = portableListName(definition.model, prefix);
    let list = lists.get(displayName);
    if (!list) {
      list = await graph<GraphList>(`/sites/${encodeURIComponent(configuredSiteId)}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, description: `COVEX portable H10B · ${definition.model}`, list: { template: "genericList" } }),
      });
      lists.set(displayName, list);
    }
    const current = await graph<{ value: GraphColumn[] }>(`/sites/${encodeURIComponent(configuredSiteId)}/lists/${encodeURIComponent(list.id)}/columns?$top=200`);
    const names = new Map(current.value.map((column) => [column.name, column]));
    for (const column of definition.columns) {
      const previous = names.get(column.name);
      if (previous) {
        const typeMatches = column.type === "number" ? Boolean(previous.number)
          : column.type === "dateTime" ? Boolean(previous.dateTime)
            : Boolean(previous.text) && Boolean(previous.text?.allowMultipleLines) === (column.type === "multilineText");
        if (!typeMatches || Boolean(previous.indexed) !== Boolean(column.indexed) || Boolean(previous.enforceUniqueValues) !== Boolean(column.unique)) {
          throw new Error(`La columna ${displayName}/${column.name} no coincide con el esquema. IT debe revisar la migración; no se modifica automáticamente una columna existente.`);
        }
        continue;
      }
      await graph(`/sites/${encodeURIComponent(configuredSiteId)}/lists/${encodeURIComponent(list.id)}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(columnBody(column.name, column.type, column.indexed, column.unique)),
      });
    }
  }
  if (seedSynthetic) {
  for (const department of defaultDepartments) await seedRecord(lists, "Department", department.id, department.code.toLocaleUpperCase(), department.active ? "ACTIVE" : "INACTIVE", department);
  for (const value of demoTrainingCatalogs.trainingTypes) await seedRecord(lists, "TrainingType", value.id, value.code.toLocaleUpperCase(), value.active ? "ACTIVE" : "INACTIVE", value);
  for (const value of demoTrainingCatalogs.modalities) await seedRecord(lists, "Modality", value.id, value.code.toLocaleUpperCase(), value.active ? "ACTIVE" : "INACTIVE", value);
  for (const value of demoTrainingCatalogs.evaluationMethods) await seedRecord(lists, "EvaluationMethod", value.id, value.code.toLocaleUpperCase(), value.active ? "ACTIVE" : "INACTIVE", value);
  for (const value of [demoAnnexIIITemplate, demoAnnexIVTemplate, demoAnnexVTemplate]) await seedRecord(lists, "TemplateVersion", value.id, `${value.annexType}:${value.procedureCode}:${value.templateVersion}`, "ACTIVE", value);
  }
  if (bootstrapObjectId || bootstrapEmail || bootstrapName) {
    if (!bootstrapObjectId || !bootstrapEmail || !bootstrapName || !/^[0-9a-f-]{36}$/i.test(bootstrapObjectId)) {
      throw new Error("El bootstrap requiere PORTABLE_BOOTSTRAP_ADMIN_OBJECT_ID, PORTABLE_BOOTSTRAP_ADMIN_EMAIL y PORTABLE_BOOTSTRAP_ADMIN_DISPLAY_NAME válidos.");
    }
    const listName = portableListName("UserProfile", prefix);
    const list = lists.get(listName)!;
    const existingUsers = await graph<{ value: Array<{ id: string }> }>(`/sites/${encodeURIComponent(configuredSiteId)}/lists/${encodeURIComponent(list.id)}/items?$expand=fields&$filter=${encodeURIComponent(`fields/CovexUniqueKey eq '${bootstrapObjectId.toLocaleLowerCase()}'`)}&$top=2`);
    if (existingUsers.value.length === 0) {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const user = { id, entraObjectId: bootstrapObjectId, email: bootstrapEmail, displayName: bootstrapName, role: "ADMIN", active: true, createdAt: now, updatedAt: now };
      await graph(`/sites/${encodeURIComponent(configuredSiteId)}/lists/${encodeURIComponent(list.id)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { Title: bootstrapName.slice(0, 255), CovexId: id, CovexUniqueKey: bootstrapObjectId.toLocaleLowerCase(), CovexStatus: "ADMIN", CovexUpdatedAt: now, CovexPayload: JSON.stringify(user) } }),
      });
    }
  }
    console.log(`Aprovisionamiento idempotente completado: ${PORTABLE_LIST_SCHEMA.length} listas verificadas.`);
  }
}

void main();
