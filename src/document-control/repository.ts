import type { DocumentControl, DocumentControlAttachmentContent, DocumentControlAttachmentInput, DocumentControlAttachmentMeta, DocumentControlInput } from "./types";
import type { CurrentUser } from "@/auth/current-user";
import { InMemoryAuditEventRepository, type AuditEventRepository } from "@/administration/audit-repository";
import { calculateDocumentStatus } from "./domain";

export interface DocumentControlRepository {
  findBySessionId(sessionId: string): Promise<DocumentControl | undefined>;
  findBySessionIds(sessionIds: string[]): Promise<DocumentControl[]>;
  upsert(sessionId: string, input: DocumentControlInput, actor: CurrentUser | string): Promise<DocumentControl>;
  findAttachmentsBySessionId(sessionId: string): Promise<DocumentControlAttachmentMeta[]>;
  findAttachmentsBySessionIds(sessionIds: string[]): Promise<DocumentControlAttachmentMeta[]>;
  addAttachment(sessionId: string, input: DocumentControlAttachmentInput, actor: CurrentUser | string): Promise<DocumentControlAttachmentMeta>;
  getAttachment(attachmentId: string): Promise<DocumentControlAttachmentContent | undefined>;
  removeAttachment(attachmentId: string, actor: CurrentUser | string): Promise<DocumentControlAttachmentMeta | undefined>;
}
const fixedTime = "2026-06-20T10:00:00.000Z";
export const demoDocumentControls: DocumentControl[] = [
  { id: "document-control-demo-partial", sessionId: "session-demo-4", signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: false, dossierPrinted: false, updatedByUserId: "demo-user", updatedAt: fixedTime },
  { id: "document-control-demo-complete", sessionId: "session-demo-5", signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: true, dossierPrinted: true, updatedByUserId: "demo-user", updatedAt: fixedTime },
];

type StoredAttachment = DocumentControlAttachmentMeta & { dataBase64: string };
const toAttachmentMeta = (item: StoredAttachment): DocumentControlAttachmentMeta => ({
  id: item.id,
  documentControlId: item.documentControlId,
  sessionId: item.sessionId,
  category: item.category,
  fileName: item.fileName,
  mimeType: item.mimeType,
  sizeBytes: item.sizeBytes,
  uploadedByUserId: item.uploadedByUserId,
  createdAt: item.createdAt,
});

export class InMemoryDocumentControlRepository implements DocumentControlRepository {
  private controls: DocumentControl[];
  private attachments: StoredAttachment[];

  constructor(
    seed: DocumentControl[] = demoDocumentControls,
    private readonly audit: AuditEventRepository = new InMemoryAuditEventRepository(),
    attachments: StoredAttachment[] = [],
  ) {
    this.controls = structuredClone(seed);
    this.attachments = structuredClone(attachments);
  }

  async findBySessionId(sessionId: string) {
    const found = this.controls.find((item) => item.sessionId === sessionId);
    return found ? structuredClone(found) : undefined;
  }

  async findBySessionIds(sessionIds: string[]) {
    const ids = new Set(sessionIds);
    return structuredClone(this.controls.filter((item) => ids.has(item.sessionId)));
  }

  async upsert(sessionId: string, input: DocumentControlInput, actor: CurrentUser | string) {
    const updatedByUserId = typeof actor === "string" ? actor : actor.id;
    const index = this.controls.findIndex((item) => item.sessionId === sessionId);
    const previous = index >= 0 ? this.controls[index] : undefined;
    if (previous && JSON.stringify({
      signedAnnexIII: previous.signedAnnexIII,
      trainingMaterialArchived: previous.trainingMaterialArchived,
      evaluationEvidenceArchived: previous.evaluationEvidenceArchived,
      dossierPrinted: previous.dossierPrinted,
      signedAnnexIIIReason: previous.signedAnnexIIIReason,
      trainingMaterialReason: previous.trainingMaterialReason,
      evaluationEvidenceReason: previous.evaluationEvidenceReason,
    }) === JSON.stringify(input)) return structuredClone(previous);
    const control: DocumentControl = {
      ...(index >= 0 ? this.controls[index] : { id: crypto.randomUUID(), sessionId }),
      ...input,
      updatedByUserId,
      updatedAt: new Date().toISOString(),
    };
    const beforeInput: DocumentControlInput = previous ? {
      signedAnnexIII: previous.signedAnnexIII,
      trainingMaterialArchived: previous.trainingMaterialArchived,
      evaluationEvidenceArchived: previous.evaluationEvidenceArchived,
      dossierPrinted: previous.dossierPrinted,
      signedAnnexIIIReason: previous.signedAnnexIIIReason,
      trainingMaterialReason: previous.trainingMaterialReason,
      evaluationEvidenceReason: previous.evaluationEvidenceReason,
    } : {
      signedAnnexIII: false,
      trainingMaterialArchived: false,
      evaluationEvidenceArchived: false,
      dossierPrinted: false,
    };
    const beforeJson = { ...beforeInput, documentStatus: calculateDocumentStatus(beforeInput) };
    const afterJson = { ...input, documentStatus: calculateDocumentStatus(input) };
    await this.audit.append({ actorUserId: updatedByUserId, entityType: "DOCUMENT_CONTROL", entityId: control.id, action: "DOCUMENT_CONTROL_UPDATED", beforeJson, afterJson, contextJson: { sessionId } });
    if (index >= 0) this.controls[index] = control;
    else this.controls.push(control);
    return structuredClone(control);
  }

  async findAttachmentsBySessionId(sessionId: string) {
    return this.attachments
      .filter((item) => item.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => structuredClone(toAttachmentMeta(item)));
  }

  async findAttachmentsBySessionIds(sessionIds: string[]) {
    const ids = new Set(sessionIds);
    return this.attachments
      .filter((item) => ids.has(item.sessionId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => structuredClone(toAttachmentMeta(item)));
  }

  async addAttachment(sessionId: string, input: DocumentControlAttachmentInput, actor: CurrentUser | string) {
    const uploadedByUserId = typeof actor === "string" ? actor : actor.id;
    let control = this.controls.find((item) => item.sessionId === sessionId);
    const controlWasCreated = !control;
    if (!control) {
      control = {
        id: crypto.randomUUID(),
        sessionId,
        signedAnnexIII: false,
        trainingMaterialArchived: false,
        evaluationEvidenceArchived: false,
        dossierPrinted: false,
        updatedByUserId: uploadedByUserId,
        updatedAt: new Date().toISOString(),
      };
      this.controls.push(control);
    }
    const stored: StoredAttachment = {
      id: crypto.randomUUID(),
      documentControlId: control.id,
      sessionId,
      category: input.category,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.content.byteLength,
      uploadedByUserId,
      createdAt: new Date().toISOString(),
      dataBase64: input.content.toString("base64"),
    };
    const meta = toAttachmentMeta(stored);
    try {
      await this.audit.append({
        actorUserId: uploadedByUserId,
        entityType: "DOCUMENT_CONTROL_ATTACHMENT",
        entityId: stored.id,
        action: "DOCUMENT_CONTROL_ATTACHMENT_ADDED",
        afterJson: meta,
        contextJson: { sessionId, category: input.category },
      });
      this.attachments.push(stored);
      return structuredClone(meta);
    } catch (error) {
      if (controlWasCreated) this.controls = this.controls.filter((item) => item.id !== control?.id);
      throw error;
    }
  }

  async getAttachment(attachmentId: string) {
    const stored = this.attachments.find((item) => item.id === attachmentId);
    if (!stored) return undefined;
    const { dataBase64, ...meta } = stored;
    return { ...structuredClone(meta), content: Buffer.from(dataBase64, "base64") };
  }

  async removeAttachment(attachmentId: string, actor: CurrentUser | string) {
    const actorUserId = typeof actor === "string" ? actor : actor.id;
    const index = this.attachments.findIndex((item) => item.id === attachmentId);
    if (index < 0) return undefined;
    const stored = this.attachments[index];
    const meta = toAttachmentMeta(stored);
    await this.audit.append({
      actorUserId,
      entityType: "DOCUMENT_CONTROL_ATTACHMENT",
      entityId: attachmentId,
      action: "DOCUMENT_CONTROL_ATTACHMENT_REMOVED",
      beforeJson: meta,
      contextJson: { sessionId: meta.sessionId, category: meta.category },
    });
    this.attachments.splice(index, 1);
    return structuredClone(meta);
  }
}
