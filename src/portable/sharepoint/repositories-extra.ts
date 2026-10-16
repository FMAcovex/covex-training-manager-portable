import { InMemoryCatalogAdminRepository, type CatalogAdminRepository } from "@/administration/catalog-repository";
import { InMemoryUserProfileRepository, type UserProfileRepository } from "@/administration/user-profile-repository";
import { AdminConflictError, type AdminCatalogItem, type CatalogCreateInput, type CatalogKind, type CatalogUpdateInput, type UserCreateInput, type UserProfile, type UserUpdateInput } from "@/administration/types";
import type { AuditEventRepository } from "@/administration/audit-repository";
import type { DemoCatalogStore } from "@/administration/demo-catalog-store";
import { InMemoryAnnexRepository, type AnnexRepository, type GeneratedDocumentInput } from "@/annexes/annex-repository";
import type { AnnexType, GeneratedDocument, TemplateVersion } from "@/annexes/types";
import type { CurrentUser } from "@/auth/current-user";
import type { TemplateCreateInput, TemplateUpdateInput } from "@/administration/types";
import { InMemoryDocumentControlRepository, type DocumentControlRepository } from "@/document-control/repository";
import type { DocumentControl, DocumentControlAttachmentInput, DocumentControlAttachmentMeta, DocumentControlInput } from "@/document-control/types";
import type { Department } from "@/domain/department";
import type { CatalogItem } from "@/domain/training-catalogs";
import type { TrainerDocumentContent, TrainerDocumentInput, TrainerDocumentMeta, TrainerQualification, TrainerQualificationInput } from "@/domain/trainer";
import { portableAccessToken } from "@/portable/auth/server-session";
import { readPortableServerConfiguration } from "@/portable/config";
import { GraphClient } from "@/portable/graph/graph-client";
import { SharePointDocumentRepository } from "@/portable/sharepoint/document-repository";
import type { PortableEntityStore } from "@/portable/sharepoint/entity-store";
import type { PeopleRepository } from "@/server/people-repository";
import { InMemoryTrainerRepository, type TrainerListOptions, type TrainerRepository } from "@/server/trainer-repository";
import type { TrainingRepository } from "@/server/training-repository";
import { createHash } from "node:crypto";
import type { PortableWriteCoordinator } from "./write-coordinator";
import { assertFileUploadEnvelope, validateFileUploadContent } from "@/security/file-upload-policy";

const clone = <T>(value: T): T => structuredClone(value);
const validationAudit: AuditEventRepository = { append: async (event) => ({ ...event, id: "validation", timestamp: "" }), list: async () => [] };
const catalogModel = (kind: CatalogKind) => kind === "departments" ? "Department" as const
  : kind === "training-types" ? "TrainingType" as const
    : kind === "modalities" ? "Modality" as const : "EvaluationMethod" as const;

export class PortableUserProfileRepository implements UserProfileRepository {
  constructor(private readonly store: PortableEntityStore, private readonly audit: AuditEventRepository) {}
  async rows() { return (await this.store.list<UserProfile>("UserProfile")).map((item) => item.data); }
  async list() { return clone((await this.rows()).sort((a, b) => a.displayName.localeCompare(b.displayName, "es"))); }
  async findById(id: string) { return clone((await this.store.get<UserProfile>("UserProfile", id))?.data); }
  async findByEntraObjectId(entraObjectId: string) { return clone((await this.store.findUnique<UserProfile>("UserProfile", entraObjectId.trim().toLocaleLowerCase()))?.data); }

  async create(input: UserCreateInput, actor: CurrentUser) {
    const engine = new InMemoryUserProfileRepository({ append: async (event) => ({ ...event, id: "validation", timestamp: "" }), list: async () => [] }, await this.rows());
    const user = await engine.create(input, actor);
    await this.store.create("UserProfile", user.id, user, { uniqueKey: user.entraObjectId.toLocaleLowerCase(), status: user.active ? user.role : "INACTIVE" });
    await this.audit.append({ actorUserId: actor.id, entityType: "USER_PROFILE", entityId: user.id, action: "USER_PROFILE_CREATED", afterJson: user });
    return clone(user);
  }

  async update(id: string, input: UserUpdateInput, actor: CurrentUser) {
    const current = await this.store.get<UserProfile>("UserProfile", id);
    if (!current) return undefined;
    const engine = new InMemoryUserProfileRepository({ append: async (event) => ({ ...event, id: "validation", timestamp: "" }), list: async () => [] }, await this.rows());
    const user = await engine.update(id, input, actor);
    if (!user) return undefined;
    await this.store.update("UserProfile", current, user, { uniqueKey: user.entraObjectId.toLocaleLowerCase(), status: user.active ? user.role : "INACTIVE" });
    await this.audit.append({ actorUserId: actor.id, entityType: "USER_PROFILE", entityId: id, action: current.data.role !== user.role ? "USER_ROLE_CHANGED" : current.data.active !== user.active ? (user.active ? "USER_ACTIVATED" : "USER_DEACTIVATED") : "USER_PROFILE_UPDATED", beforeJson: current.data, afterJson: user });
    return clone(user);
  }
}

export class PortableCatalogAdminRepository implements CatalogAdminRepository {
  constructor(private readonly store: PortableEntityStore, private readonly audit: AuditEventRepository, private readonly trainings: TrainingRepository, private readonly people: PeopleRepository) {}
  private async catalogStore(): Promise<DemoCatalogStore> {
    const read = async <T>(model: "TrainingType" | "Modality" | "EvaluationMethod" | "Department") => (await this.store.list<T>(model)).map((item) => item.data);
    const [trainingTypes, modalities, evaluationMethods, departments] = await Promise.all([read<CatalogItem>("TrainingType"), read<CatalogItem>("Modality"), read<CatalogItem>("EvaluationMethod"), read<Department>("Department")]);
    return { trainingTypes, modalities, evaluationMethods, departments };
  }
  private async engine() { return new InMemoryCatalogAdminRepository(validationAudit, this.trainings, this.people, await this.catalogStore()); }
  async list(kind: CatalogKind) { return (await this.engine()).list(kind); }
  async create(kind: CatalogKind, input: CatalogCreateInput, actor: CurrentUser) {
    const rows = await this.list(kind);
    if (rows.some((item) => item.code.toLocaleLowerCase() === input.code.toLocaleLowerCase())) throw new AdminConflictError("El código ya existe");
    const item: AdminCatalogItem = { ...input, id: crypto.randomUUID(), referenced: false };
    const stored = { id: item.id, code: item.code, name: item.name, active: item.active };
    await this.store.create(catalogModel(kind), item.id, stored, { uniqueKey: item.code.toLocaleUpperCase(), status: item.active ? "ACTIVE" : "INACTIVE" });
    await this.audit.append({ actorUserId: actor.id, entityType: "CATALOG", entityId: item.id, action: "CATALOG_CREATED", afterJson: item, contextJson: { kind } });
    return clone(item);
  }
  async update(kind: CatalogKind, id: string, input: CatalogUpdateInput, actor: CurrentUser) {
    const model = catalogModel(kind); const current = await this.store.get<CatalogItem>(model, id); if (!current) return undefined;
    const updated = await (await this.engine()).update(kind, id, input, actor); if (!updated) return undefined;
    await this.store.update(model, current, { id: updated.id, code: updated.code, name: updated.name, active: updated.active }, { uniqueKey: updated.code.toLocaleUpperCase(), status: updated.active ? "ACTIVE" : "INACTIVE" });
    await this.audit.append({ actorUserId: actor.id, entityType: "CATALOG", entityId: id, action: current.data.active !== updated.active ? (updated.active ? "CATALOG_ACTIVATED" : "CATALOG_DEACTIVATED") : "CATALOG_UPDATED", beforeJson: current.data, afterJson: updated, contextJson: { kind } });
    return clone(updated);
  }
}

export class PortableAnnexRepository implements AnnexRepository {
  constructor(private readonly store: PortableEntityStore, private readonly audit: AuditEventRepository) {}
  private async templates() { return (await this.store.list<TemplateVersion>("TemplateVersion")).map((item) => item.data); }
  private async engine() { return new InMemoryAnnexRepository(await this.templates(), validationAudit); }
  async listTemplateVersions(type: AnnexType) { return clone((await this.templates()).filter((item) => item.annexType === type)); }
  async listAllTemplateVersions() { return clone((await this.templates()).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))); }
  async registerTemplateVersion(input: TemplateCreateInput, actor: CurrentUser) {
    const value = await (await this.engine()).registerTemplateVersion(input, actor);
    await this.store.create("TemplateVersion", value.id, value, { uniqueKey: `${value.annexType}:${value.procedureCode}:${value.templateVersion}`, status: value.active ? "ACTIVE" : "INACTIVE" });
    await this.audit.append({ actorUserId: actor.id, entityType: "TEMPLATE_VERSION", entityId: value.id, action: "TEMPLATE_VERSION_REGISTERED", afterJson: value });
    return clone(value);
  }
  async updateTemplateVersion(id: string, input: TemplateUpdateInput, actor: CurrentUser) {
    const current = await this.store.get<TemplateVersion>("TemplateVersion", id); if (!current) return undefined;
    const value = await (await this.engine()).updateTemplateVersion(id, input, actor); if (!value) return undefined;
    await this.store.update("TemplateVersion", current, value, { uniqueKey: `${value.annexType}:${value.procedureCode}:${value.templateVersion}`, status: value.active ? "ACTIVE" : "INACTIVE" });
    await this.audit.append({ actorUserId: actor.id, entityType: "TEMPLATE_VERSION", entityId: id, action: current.data.active !== value.active ? (value.active ? "TEMPLATE_VERSION_ACTIVATED" : "TEMPLATE_VERSION_DEACTIVATED") : "TEMPLATE_VERSION_UPDATED", beforeJson: current.data, afterJson: value });
    return clone(value);
  }
  async createGeneratedDocument(input: GeneratedDocumentInput) {
    const value = await (await this.engine()).createGeneratedDocument(input);
    await this.store.create("GeneratedDocument", value.id, value, { parentId: value.sessionId ?? value.personId, year: value.year, status: value.annexType });
    return clone(value);
  }
  async listGeneratedDocuments(sessionId: string) { return (await this.store.list<GeneratedDocument>("GeneratedDocument", { parentId: sessionId })).map((item) => clone(item.data)); }
}

type StoredDocument = TrainerDocumentMeta & { driveItemId: string; driveETag: string; sha256?: string };
type StoredAttachment = DocumentControlAttachmentMeta & { driveItemId: string; driveETag: string; sha256?: string };
type StoredQualification = Omit<TrainerQualification, "person" | "current">;

async function documents() {
  const config = readPortableServerConfiguration();
  return new SharePointDocumentRepository(new GraphClient(await portableAccessToken()), config.siteId, config.documentDriveId);
}

function qualificationData(value: TrainerQualification): StoredQualification {
  const data = clone(value) as Partial<TrainerQualification>;
  delete data.person;
  delete data.current;
  return data as StoredQualification;
}

function documentMeta<T extends TrainerDocumentMeta | DocumentControlAttachmentMeta>(value: T & { driveItemId: string; driveETag: string }): T {
  const data = clone(value) as T & { driveItemId?: string; driveETag?: string; sha256?: string };
  delete data.driveItemId;
  delete data.driveETag;
  delete data.sha256;
  return data;
}

export class PortableTrainerRepository implements TrainerRepository {
  constructor(private readonly store: PortableEntityStore, private readonly people: PeopleRepository, private readonly audit: AuditEventRepository, private readonly writes?: PortableWriteCoordinator) {}
  private async qualifications() { return (await this.store.list<StoredQualification>("TrainerQualification")).map((item) => item.data); }
  private async engine() { return new InMemoryTrainerRepository(this.people, { append: async (event) => ({ ...event, id: "validation", timestamp: "" }), list: async () => [] }, false, await this.qualifications(), []); }
  async list(options?: TrainerListOptions) { return (await this.engine()).list(options); }
  async findQualificationById(id: string) { return (await this.engine()).findQualificationById(id); }
  async createQualification(input: TrainerQualificationInput, actorUserId: string) {
    const value = await (await this.engine()).createQualification(input, actorUserId); const data = qualificationData(value);
    await this.store.create("TrainerQualification", value.id, data, { parentId: value.personId, uniqueKey: `${value.personId}:${value.authorizedSubject.trim().toLocaleLowerCase("es")}:${value.qualifiedFrom}`, status: value.current ? "CURRENT" : "EXPIRED" });
    await this.audit.append({ actorUserId, entityType: "TRAINER_QUALIFICATION", entityId: value.id, action: "TRAINER_QUALIFICATION_CREATED", afterJson: data }); return clone(value);
  }
  async createQualifiedTrainer(personInput: Parameters<TrainerRepository["createQualifiedTrainer"]>[0], qualificationInput: Parameters<TrainerRepository["createQualifiedTrainer"]>[1], actorUserId: string) {
    const person = await this.people.create(personInput, actorUserId);
    try { return await this.createQualification({ ...qualificationInput, personId: person.id }, actorUserId); }
    catch (error) { await this.people.rollbackCreated(person.id); throw error; }
  }
  private async mutate(id: string, actorUserId: string, action: string, operation: (engine: InMemoryTrainerRepository) => Promise<TrainerQualification | undefined>) {
    const current = await this.store.get<StoredQualification>("TrainerQualification", id); if (!current) return undefined;
    const value = await operation(await this.engine()); if (!value) return undefined; const data = qualificationData(value);
    await this.store.update("TrainerQualification", current, data, { parentId: value.personId, uniqueKey: `${value.personId}:${value.authorizedSubject.trim().toLocaleLowerCase("es")}:${value.qualifiedFrom}`, status: value.annulledAt ? "ANNULLED" : value.current ? "CURRENT" : "EXPIRED" });
    await this.audit.append({ actorUserId, entityType: "TRAINER_QUALIFICATION", entityId: id, action, beforeJson: current.data, afterJson: data }); return clone(value);
  }
  updateQualification(id: string, input: TrainerQualificationInput, actorUserId: string) { return this.mutate(id, actorUserId, "TRAINER_QUALIFICATION_UPDATED", (engine) => engine.updateQualification(id, input, actorUserId)); }
  retireQualification(id: string, qualifiedTo: string, actorUserId: string) { return this.mutate(id, actorUserId, "TRAINER_QUALIFICATION_RETIRED", (engine) => engine.retireQualification(id, qualifiedTo, actorUserId)); }
  annulQualification(id: string, reason: string, actorUserId: string) { return this.mutate(id, actorUserId, "TRAINER_QUALIFICATION_ANNULLED", (engine) => engine.annulQualification(id, reason, actorUserId)); }
  async importQualifications(inputs: TrainerQualificationInput[], actorUserId: string) {
    const values = await (await this.engine()).importQualifications(inputs, actorUserId);
    for (const value of values) { const data = qualificationData(value); await this.store.create("TrainerQualification", value.id, data, { parentId: value.personId, uniqueKey: `${value.personId}:${value.authorizedSubject.trim().toLocaleLowerCase("es")}:${value.qualifiedFrom}`, status: value.current ? "CURRENT" : "EXPIRED" }); }
    await this.audit.append({ actorUserId, entityType: "TRAINER_QUALIFICATION_IMPORT", entityId: crypto.randomUUID(), action: "TRAINER_QUALIFICATIONS_IMPORTED", afterJson: { count: values.length } });
    return clone(values);
  }
  async listDocuments(personId: string) { return (await this.store.list<StoredDocument>("TrainerDocument", { parentId: personId })).map(({ data }) => documentMeta(data)); }
  async listAllDocuments() { return (await this.store.list<StoredDocument>("TrainerDocument")).map(({ data }) => documentMeta(data)); }
  async addDocument(personId: string, input: TrainerDocumentInput, actorUserId: string) {
    const person = await this.people.findById(personId);
    if (!person?.active) throw new Error("La persona seleccionada no existe o está inactiva");
    assertFileUploadEnvelope(input.fileName, input.content.byteLength, await this.listDocuments(personId));
    validateFileUploadContent(input.fileName, input.content);
    const id = crypto.randomUUID();
    await this.writes?.externalWrite({ model: "TrainerDocument", id, action: "create" });
    const uploaded = await (await documents()).upload(`trainers/${personId}`, `${id}-${input.fileName}`, input.mimeType, input.content);
    const meta: TrainerDocumentMeta = { id, personId, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.content.byteLength, uploadedByUserId: actorUserId, createdAt: new Date().toISOString() };
    try { await this.store.create("TrainerDocument", id, { ...meta, driveItemId: uploaded.id, driveETag: uploaded.eTag, sha256: createHash("sha256").update(input.content).digest("hex") }, { parentId: personId }); }
    catch (error) { await (await documents()).delete(uploaded.id, uploaded.eTag); throw error; }
    await this.audit.append({ actorUserId, entityType: "TRAINER_DOCUMENT", entityId: id, action: "TRAINER_DOCUMENT_ADDED", afterJson: meta }); return clone(meta);
  }
  async getDocument(documentId: string): Promise<TrainerDocumentContent | undefined> {
    const row = await this.store.get<StoredDocument>("TrainerDocument", documentId); if (!row) return undefined;
    const response = await (await documents()).download(row.data.driveItemId); const meta = documentMeta(row.data);
    const content = Buffer.from(await response.arrayBuffer());
    if (content.byteLength !== row.data.sizeBytes || (row.data.sha256 && createHash("sha256").update(content).digest("hex") !== row.data.sha256)) throw new Error("El documento recuperado no supera la comprobación de integridad.");
    return { ...clone(meta), content };
  }
  async removeDocument(documentId: string, actorUserId: string) {
    const row = await this.store.get<StoredDocument>("TrainerDocument", documentId); if (!row) return undefined;
    const { driveItemId, driveETag } = row.data; const meta = documentMeta(row.data);
    await this.writes?.externalWrite({ model: "TrainerDocument", id: documentId, action: "delete" });
    await (await documents()).delete(driveItemId, driveETag); await this.store.delete("TrainerDocument", row);
    await this.audit.append({ actorUserId, entityType: "TRAINER_DOCUMENT", entityId: documentId, action: "TRAINER_DOCUMENT_REMOVED", beforeJson: meta }); return clone(meta);
  }
}

export class PortableDocumentControlRepository implements DocumentControlRepository {
  constructor(private readonly store: PortableEntityStore, private readonly audit: AuditEventRepository, private readonly writes?: PortableWriteCoordinator) {}
  async findBySessionId(sessionId: string) { return clone((await this.store.findUnique<DocumentControl>("DocumentControl", sessionId))?.data); }
  async findBySessionIds(ids: string[]) { const wanted = new Set(ids); return (await this.store.list<DocumentControl>("DocumentControl")).map((x) => x.data).filter((x) => wanted.has(x.sessionId)).map(clone); }
  async upsert(sessionId: string, input: DocumentControlInput, actor: CurrentUser | string) {
    const actorId = typeof actor === "string" ? actor : actor.id; const current = await this.store.findUnique<DocumentControl>("DocumentControl", sessionId);
    const engine = new InMemoryDocumentControlRepository(current ? [current.data] : [], { append: async (event) => ({ ...event, id: "validation", timestamp: "" }), list: async () => [] });
    const value = await engine.upsert(sessionId, input, actor);
    if (current) await this.store.update("DocumentControl", current, value, { uniqueKey: sessionId, parentId: sessionId }); else await this.store.create("DocumentControl", value.id, value, { uniqueKey: sessionId, parentId: sessionId });
    await this.audit.append({ actorUserId: actorId, entityType: "DOCUMENT_CONTROL", entityId: value.id, action: "DOCUMENT_CONTROL_UPDATED", beforeJson: current?.data, afterJson: value, contextJson: { sessionId } }); return clone(value);
  }
  async findAttachmentsBySessionId(sessionId: string) { return (await this.store.list<StoredAttachment>("DocumentControlAttachment", { parentId: sessionId })).map(({ data }) => documentMeta(data)); }
  async findAttachmentsBySessionIds(ids: string[]) { const values = await Promise.all(ids.map((id) => this.findAttachmentsBySessionId(id))); return values.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async addAttachment(sessionId: string, input: DocumentControlAttachmentInput, actor: CurrentUser | string) {
    assertFileUploadEnvelope(input.fileName, input.content.byteLength, await this.findAttachmentsBySessionId(sessionId));
    validateFileUploadContent(input.fileName, input.content);
    const actorId = typeof actor === "string" ? actor : actor.id; let control = await this.findBySessionId(sessionId);
    if (!control) control = await this.upsert(sessionId, { signedAnnexIII: false, trainingMaterialArchived: false, evaluationEvidenceArchived: false, dossierPrinted: false }, actor);
    const id = crypto.randomUUID();
    await this.writes?.externalWrite({ model: "DocumentControlAttachment", id, action: "create" });
    const uploaded = await (await documents()).upload(`sessions/${sessionId}`, `${id}-${input.fileName}`, input.mimeType, input.content);
    const meta: DocumentControlAttachmentMeta = { id, documentControlId: control.id, sessionId, category: input.category, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.content.byteLength, uploadedByUserId: actorId, createdAt: new Date().toISOString() };
    try { await this.store.create("DocumentControlAttachment", id, { ...meta, driveItemId: uploaded.id, driveETag: uploaded.eTag, sha256: createHash("sha256").update(input.content).digest("hex") }, { parentId: sessionId, status: input.category }); }
    catch (error) { await (await documents()).delete(uploaded.id, uploaded.eTag); throw error; }
    await this.audit.append({ actorUserId: actorId, entityType: "DOCUMENT_CONTROL_ATTACHMENT", entityId: id, action: "DOCUMENT_CONTROL_ATTACHMENT_ADDED", afterJson: meta, contextJson: { sessionId, category: input.category } }); return clone(meta);
  }
  async getAttachment(id: string) {
    const row = await this.store.get<StoredAttachment>("DocumentControlAttachment", id); if (!row) return undefined;
    const response = await (await documents()).download(row.data.driveItemId); const meta = documentMeta(row.data);
    const content = Buffer.from(await response.arrayBuffer());
    if (content.byteLength !== row.data.sizeBytes || (row.data.sha256 && createHash("sha256").update(content).digest("hex") !== row.data.sha256)) throw new Error("El documento recuperado no supera la comprobación de integridad.");
    return { ...clone(meta), content };
  }
  async removeAttachment(id: string, actor: CurrentUser | string) {
    const row = await this.store.get<StoredAttachment>("DocumentControlAttachment", id); if (!row) return undefined;
    const actorId = typeof actor === "string" ? actor : actor.id; const { driveItemId, driveETag } = row.data; const meta = documentMeta(row.data);
    await this.writes?.externalWrite({ model: "DocumentControlAttachment", id, action: "delete" });
    await (await documents()).delete(driveItemId, driveETag); await this.store.delete("DocumentControlAttachment", row);
    await this.audit.append({ actorUserId: actorId, entityType: "DOCUMENT_CONTROL_ATTACHMENT", entityId: id, action: "DOCUMENT_CONTROL_ATTACHMENT_REMOVED", beforeJson: meta }); return clone(meta);
  }
}
