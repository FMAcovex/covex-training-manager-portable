import type { AuditEventRepository } from "@/administration/audit-repository";
import type { Person, PersonInput } from "@/domain/person";
import { normalizeTrainerSubject, qualificationIsCurrent, type TrainerDocumentContent, type TrainerDocumentInput, type TrainerDocumentMeta, type TrainerQualification, type TrainerQualificationInput } from "@/domain/trainer";
import { readDemoJson, writeDemoJson } from "@/demo/demo-data-store";
import type { PeopleRepository } from "@/server/people-repository";

export type TrainerListOptions = { currentOnly?: boolean; personType?: Person["personType"]; includeAnnulled?: boolean };

export interface TrainerRepository {
  list(options?: TrainerListOptions): Promise<TrainerQualification[]>;
  findQualificationById(id: string): Promise<TrainerQualification | undefined>;
  createQualification(input: TrainerQualificationInput, actorUserId: string): Promise<TrainerQualification>;
  createQualifiedTrainer(personInput: PersonInput, qualificationInput: Omit<TrainerQualificationInput, "personId">, actorUserId: string): Promise<TrainerQualification>;
  updateQualification(id: string, input: TrainerQualificationInput, actorUserId: string): Promise<TrainerQualification | undefined>;
  retireQualification(id: string, qualifiedTo: string, actorUserId: string): Promise<TrainerQualification | undefined>;
  annulQualification(id: string, reason: string, actorUserId: string): Promise<TrainerQualification | undefined>;
  importQualifications(inputs: TrainerQualificationInput[], actorUserId: string): Promise<TrainerQualification[]>;
  listDocuments(personId: string): Promise<TrainerDocumentMeta[]>;
  listAllDocuments(): Promise<TrainerDocumentMeta[]>;
  addDocument(personId: string, input: TrainerDocumentInput, actorUserId: string): Promise<TrainerDocumentMeta>;
  getDocument(documentId: string): Promise<TrainerDocumentContent | undefined>;
  removeDocument(documentId: string, actorUserId: string): Promise<TrainerDocumentMeta | undefined>;
}

export class TrainerReferenceError extends Error {}
export class TrainerConflictError extends Error {}

type StoredQualification = Omit<TrainerQualification, "person" | "current">;
type StoredDocument = TrainerDocumentMeta & { dataBase64: string };

const toDocumentMeta = (item: StoredDocument): TrainerDocumentMeta => ({
  id: item.id,
  personId: item.personId,
  fileName: item.fileName,
  mimeType: item.mimeType,
  sizeBytes: item.sizeBytes,
  uploadedByUserId: item.uploadedByUserId,
  createdAt: item.createdAt,
});

const demoQualifications: StoredQualification[] = [
  {
    id: "trainer-q-demo-internal",
    personId: "demo-1",
    authorizedSubject: "Buenas prácticas en zona controlada",
    evidence: "Experiencia y formación ficticias de demostración",
    qualifiedFrom: "2026-01-01",
    qualifiedTo: undefined,
    createdAt: "2026-01-15T09:00:00.000Z",
    updatedAt: "2026-01-15T09:00:00.000Z",
  },
  {
    id: "trainer-q-demo-external",
    personId: "demo-2",
    authorizedSubject: "Actualización técnica de equipo simulado",
    evidence: "Acreditación externa ficticia de demostración",
    qualifiedFrom: "2026-01-01",
    qualifiedTo: undefined,
    createdAt: "2026-01-15T09:00:00.000Z",
    updatedAt: "2026-01-15T09:00:00.000Z",
  },
];

function uniqueKey(input: Pick<TrainerQualificationInput, "personId" | "authorizedSubject" | "qualifiedFrom">) {
  return [input.personId, normalizeTrainerSubject(input.authorizedSubject), input.qualifiedFrom].join("|");
}

export class InMemoryTrainerRepository implements TrainerRepository {
  private qualifications: StoredQualification[];
  private documents: StoredDocument[];

  constructor(
    private readonly people: PeopleRepository,
    private readonly audit: AuditEventRepository,
    private readonly persist = false,
    qualifications?: StoredQualification[],
    documents?: StoredDocument[],
  ) {
    this.qualifications = structuredClone(qualifications ?? (persist ? readDemoJson<StoredQualification[]>("trainer-qualifications-current.json") : undefined) ?? demoQualifications);
    this.documents = structuredClone(documents ?? (persist ? readDemoJson<StoredDocument[]>("trainer-documents-current.json") : undefined) ?? []);
  }

  private save() {
    if (!this.persist) return;
    writeDemoJson("trainer-qualifications-current.json", this.qualifications);
    writeDemoJson("trainer-documents-current.json", this.documents);
  }

  private async enrich(item: StoredQualification): Promise<TrainerQualification> {
    const person = await this.people.findById(item.personId);
    if (!person) throw new TrainerReferenceError("El formador asociado ya no existe en el maestro de personal");
    return { ...structuredClone(item), person, current: qualificationIsCurrent(item) };
  }

  private async validatePerson(personId: string) {
    const person = await this.people.findById(personId);
    if (!person) throw new TrainerReferenceError("La persona seleccionada no existe");
    if (!person.active) throw new TrainerReferenceError("No se puede crear una nueva cualificación para una persona inactiva");
    return person;
  }

  private ensureUnique(input: TrainerQualificationInput, exceptId?: string, pending: StoredQualification[] = this.qualifications) {
    const key = uniqueKey(input);
    if (pending.some((item) => item.id !== exceptId && uniqueKey(item) === key)) {
      throw new TrainerConflictError("Ya existe una cualificación para ese formador, materia y fecha de alta");
    }
  }

  async list(options: TrainerListOptions = {}) {
    const enriched = await Promise.all(this.qualifications.map((item) => this.enrich(item)));
    return enriched
      .filter((item) =>
        (!item.annulledAt || options.includeAnnulled)
        && (!options.currentOnly || item.current)
        && (!options.personType || item.person.personType === options.personType)
      )
      .sort((a, b) => a.person.fullName.localeCompare(b.person.fullName, "es") || a.authorizedSubject.localeCompare(b.authorizedSubject, "es"));
  }

  async findQualificationById(id: string) {
    const found = this.qualifications.find((item) => item.id === id);
    return found ? this.enrich(found) : undefined;
  }

  async createQualification(input: TrainerQualificationInput, actorUserId: string) {
    await this.validatePerson(input.personId);
    this.ensureUnique(input);
    const timestamp = new Date().toISOString();
    const stored: StoredQualification = { ...input, id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp };
    await this.audit.append({ actorUserId, entityType: "TRAINER_QUALIFICATION", entityId: stored.id, action: "TRAINER_QUALIFICATION_CREATED", afterJson: stored });
    this.qualifications.push(stored);
    this.save();
    return this.enrich(stored);
  }

  async createQualifiedTrainer(personInput: PersonInput, qualificationInput: Omit<TrainerQualificationInput, "personId">, actorUserId: string) {
    const person = await this.people.create(personInput);
    const timestamp = new Date().toISOString();
    const stored: StoredQualification = {
      ...qualificationInput,
      personId: person.id,
      id: crypto.randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    try {
      this.qualifications.push(stored);
      this.save();
      await this.audit.append({
        actorUserId,
        entityType: "TRAINER_QUALIFICATION",
        entityId: stored.id,
        action: "TRAINER_QUALIFICATION_CREATED",
        afterJson: stored,
        contextJson: { personCreatedWithQualification: true },
      });
      return this.enrich(stored);
    } catch (error) {
      this.qualifications = this.qualifications.filter((item) => item.id !== stored.id);
      this.save();
      await this.people.rollbackCreated(person.id);
      throw error;
    }
  }

  async updateQualification(id: string, input: TrainerQualificationInput, actorUserId: string) {
    const index = this.qualifications.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    const existing = this.qualifications[index];
    if (existing.annulledAt) throw new TrainerReferenceError("Una cualificación anulada no puede modificarse");
    if (input.personId !== existing.personId) throw new TrainerReferenceError("El formador de una cualificación existente no puede cambiarse");
    this.ensureUnique(input, id);
    const updated: StoredQualification = { ...existing, ...input, updatedAt: new Date().toISOString() };
    await this.audit.append({ actorUserId, entityType: "TRAINER_QUALIFICATION", entityId: id, action: "TRAINER_QUALIFICATION_UPDATED", beforeJson: existing, afterJson: updated });
    this.qualifications[index] = updated;
    this.save();
    return this.enrich(updated);
  }

  async retireQualification(id: string, qualifiedTo: string, actorUserId: string) {
    const index = this.qualifications.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    const existing = this.qualifications[index];
    if (existing.annulledAt) throw new TrainerReferenceError("Una cualificación anulada no puede darse de baja");
    if (qualifiedTo < existing.qualifiedFrom) throw new TrainerReferenceError("La fecha de baja no puede ser anterior a la fecha de alta");
    const updated: StoredQualification = { ...existing, qualifiedTo, updatedAt: new Date().toISOString() };
    await this.audit.append({
      actorUserId,
      entityType: "TRAINER_QUALIFICATION",
      entityId: id,
      action: "TRAINER_QUALIFICATION_RETIRED",
      beforeJson: existing,
      afterJson: updated,
    });
    this.qualifications[index] = updated;
    this.save();
    return this.enrich(updated);
  }

  async annulQualification(id: string, reason: string, actorUserId: string) {
    const index = this.qualifications.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    const existing = this.qualifications[index];
    if (existing.annulledAt) return this.enrich(existing);
    const updated: StoredQualification = {
      ...existing,
      annulledAt: new Date().toISOString(),
      annulledByUserId: actorUserId,
      annulmentReason: reason.trim(),
      updatedAt: new Date().toISOString(),
    };
    await this.audit.append({
      actorUserId,
      entityType: "TRAINER_QUALIFICATION",
      entityId: id,
      action: "TRAINER_QUALIFICATION_ANNULLED",
      beforeJson: existing,
      afterJson: updated,
      contextJson: { reason: reason.trim() },
    });
    this.qualifications[index] = updated;
    this.save();
    return this.enrich(updated);
  }

  async importQualifications(inputs: TrainerQualificationInput[], actorUserId: string) {
    const pending = [...this.qualifications];
    const created: StoredQualification[] = [];
    for (const input of inputs) {
      await this.validatePerson(input.personId);
      this.ensureUnique(input, undefined, [...pending, ...created]);
      const timestamp = new Date().toISOString();
      created.push({ ...input, id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp });
    }
    await this.audit.append({
      actorUserId,
      entityType: "TRAINER_QUALIFICATION_IMPORT",
      entityId: crypto.randomUUID(),
      action: "TRAINER_QUALIFICATIONS_IMPORTED",
      afterJson: { count: created.length },
    });
    this.qualifications.push(...created);
    this.save();
    return Promise.all(created.map((item) => this.enrich(item)));
  }

  async listDocuments(personId: string) {
    return this.documents
      .filter((item) => item.personId === personId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => structuredClone(toDocumentMeta(item)));
  }

  async listAllDocuments() {
    return this.documents
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => structuredClone(toDocumentMeta(item)));
  }

  async addDocument(personId: string, input: TrainerDocumentInput, actorUserId: string) {
    await this.validatePerson(personId);
    const stored: StoredDocument = {
      id: crypto.randomUUID(),
      personId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.content.byteLength,
      uploadedByUserId: actorUserId,
      createdAt: new Date().toISOString(),
      dataBase64: input.content.toString("base64"),
    };
    const meta = toDocumentMeta(stored);
    await this.audit.append({ actorUserId, entityType: "TRAINER_DOCUMENT", entityId: stored.id, action: "TRAINER_DOCUMENT_ADDED", afterJson: meta });
    this.documents.push(stored);
    this.save();
    return structuredClone(meta);
  }

  async getDocument(documentId: string) {
    const stored = this.documents.find((item) => item.id === documentId);
    if (!stored) return undefined;
    const { dataBase64, ...meta } = stored;
    return { ...structuredClone(meta), content: Buffer.from(dataBase64, "base64") };
  }

  async removeDocument(documentId: string, actorUserId: string) {
    const index = this.documents.findIndex((item) => item.id === documentId);
    if (index < 0) return undefined;
    const [stored] = this.documents.splice(index, 1);
    const meta = toDocumentMeta(stored);
    await this.audit.append({ actorUserId, entityType: "TRAINER_DOCUMENT", entityId: documentId, action: "TRAINER_DOCUMENT_REMOVED", beforeJson: meta });
    this.save();
    return structuredClone(meta);
  }
}
