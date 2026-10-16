import type { DocumentControl as PrismaDocumentControl, PrismaClient } from "@prisma/client";
import type { DocumentControl, DocumentControlAttachmentContent, DocumentControlAttachmentInput, DocumentControlAttachmentMeta, DocumentControlInput } from "./types";
import type { DocumentControlRepository } from "./repository";
import type { CurrentUser } from "@/auth/current-user";
import { calculateDocumentStatus } from "./domain";
import { auditData } from "@/administration/prisma-audit-repository";

const toDomain = (item: PrismaDocumentControl): DocumentControl => ({
  id: item.id,
  sessionId: item.sessionId,
  signedAnnexIII: item.signedAnnexIII,
  trainingMaterialArchived: item.trainingMaterialArchived,
  evaluationEvidenceArchived: item.evaluationEvidenceArchived,
  dossierPrinted: item.dossierPrinted,
  signedAnnexIIIReason: item.signedAnnexIIIReason ?? undefined,
  trainingMaterialReason: item.trainingMaterialReason ?? undefined,
  evaluationEvidenceReason: item.evaluationEvidenceReason ?? undefined,
  updatedByUserId: item.updatedByUserId,
  updatedAt: item.updatedAt.toISOString(),
});

type AttachmentRow = {
  id: string;
  documentControlId: string;
  category: "SIGNED_ANNEX_III" | "TRAINING_MATERIAL" | "EVALUATION_EVIDENCE";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content?: Uint8Array;
  uploadedByUserId: string;
  createdAt: Date;
  documentControl: { sessionId: string };
};

const toAttachmentMeta = (item: AttachmentRow): DocumentControlAttachmentMeta => ({
  id: item.id,
  documentControlId: item.documentControlId,
  sessionId: item.documentControl.sessionId,
  category: item.category,
  fileName: item.fileName,
  mimeType: item.mimeType,
  sizeBytes: item.sizeBytes,
  uploadedByUserId: item.uploadedByUserId,
  createdAt: item.createdAt.toISOString(),
});

export class PrismaDocumentControlRepository implements DocumentControlRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySessionId(sessionId: string) {
    const item = await this.prisma.documentControl.findUnique({ where: { sessionId } });
    return item ? toDomain(item) : undefined;
  }

  async findBySessionIds(sessionIds: string[]) {
    return (await this.prisma.documentControl.findMany({ where: { sessionId: { in: sessionIds } } })).map(toDomain);
  }

  async upsert(sessionId: string, input: DocumentControlInput, actor: CurrentUser | string) {
    const updatedByUserId = typeof actor === "string" ? actor : actor.id;
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.documentControl.findUnique({ where: { sessionId } });
      if (previous && previous.signedAnnexIII === input.signedAnnexIII
        && previous.trainingMaterialArchived === input.trainingMaterialArchived
        && previous.evaluationEvidenceArchived === input.evaluationEvidenceArchived
        && previous.dossierPrinted === input.dossierPrinted
        && (previous.signedAnnexIIIReason ?? undefined) === input.signedAnnexIIIReason
        && (previous.trainingMaterialReason ?? undefined) === input.trainingMaterialReason
        && (previous.evaluationEvidenceReason ?? undefined) === input.evaluationEvidenceReason) return toDomain(previous);
      const row = await tx.documentControl.upsert({ where: { sessionId }, create: { sessionId, ...input, updatedByUserId }, update: { ...input, updatedByUserId } });
      const beforeInput: DocumentControlInput = previous ? {
        signedAnnexIII: previous.signedAnnexIII,
        trainingMaterialArchived: previous.trainingMaterialArchived,
        evaluationEvidenceArchived: previous.evaluationEvidenceArchived,
        dossierPrinted: previous.dossierPrinted,
        signedAnnexIIIReason: previous.signedAnnexIIIReason ?? undefined,
        trainingMaterialReason: previous.trainingMaterialReason ?? undefined,
        evaluationEvidenceReason: previous.evaluationEvidenceReason ?? undefined,
      } : {
        signedAnnexIII: false,
        trainingMaterialArchived: false,
        evaluationEvidenceArchived: false,
        dossierPrinted: false,
      };
      const beforeJson = { ...beforeInput, documentStatus: calculateDocumentStatus(beforeInput) };
      const afterJson = { ...input, documentStatus: calculateDocumentStatus(input) };
      await tx.auditEvent.create({ data: auditData({ actorUserId: updatedByUserId, entityType: "DOCUMENT_CONTROL", entityId: row.id, action: "DOCUMENT_CONTROL_UPDATED", beforeJson, afterJson, contextJson: { sessionId } }) });
      return toDomain(row);
    });
  }

  async findAttachmentsBySessionId(sessionId: string) {
    const rows = await this.prisma.documentControlAttachment.findMany({
      where: { documentControl: { sessionId } },
      include: { documentControl: { select: { sessionId: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((item) => toAttachmentMeta(item as AttachmentRow));
  }

  async findAttachmentsBySessionIds(sessionIds: string[]) {
    const rows = await this.prisma.documentControlAttachment.findMany({
      where: { documentControl: { sessionId: { in: sessionIds } } },
      include: { documentControl: { select: { sessionId: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((item) => toAttachmentMeta(item as AttachmentRow));
  }

  async addAttachment(sessionId: string, input: DocumentControlAttachmentInput, actor: CurrentUser | string) {
    const uploadedByUserId = typeof actor === "string" ? actor : actor.id;
    return this.prisma.$transaction(async (tx) => {
      let control = await tx.documentControl.findUnique({ where: { sessionId } });
      if (!control) {
        control = await tx.documentControl.create({
          data: {
            sessionId,
            signedAnnexIII: false,
            trainingMaterialArchived: false,
            evaluationEvidenceArchived: false,
            dossierPrinted: false,
            updatedByUserId: uploadedByUserId,
          },
        });
      }
      const row = await tx.documentControlAttachment.create({
        data: {
          documentControlId: control.id,
          category: input.category,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.content.byteLength,
          content: Uint8Array.from(input.content),
          uploadedByUserId,
        },
        include: { documentControl: { select: { sessionId: true } } },
      });
      const meta = toAttachmentMeta(row as AttachmentRow);
      await tx.auditEvent.create({
        data: auditData({
          actorUserId: uploadedByUserId,
          entityType: "DOCUMENT_CONTROL_ATTACHMENT",
          entityId: row.id,
          action: "DOCUMENT_CONTROL_ATTACHMENT_ADDED",
          afterJson: meta,
          contextJson: { sessionId, category: input.category },
        }),
      });
      return meta;
    });
  }

  async getAttachment(attachmentId: string): Promise<DocumentControlAttachmentContent | undefined> {
    const row = await this.prisma.documentControlAttachment.findUnique({
      where: { id: attachmentId },
      include: { documentControl: { select: { sessionId: true } } },
    });
    if (!row) return undefined;
    return { ...toAttachmentMeta(row as AttachmentRow), content: Buffer.from(row.content) };
  }

  async removeAttachment(attachmentId: string, actor: CurrentUser | string) {
    const actorUserId = typeof actor === "string" ? actor : actor.id;
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.documentControlAttachment.findUnique({
        where: { id: attachmentId },
        include: { documentControl: { select: { sessionId: true } } },
      });
      if (!row) return undefined;
      const meta = toAttachmentMeta(row as AttachmentRow);
      await tx.documentControlAttachment.delete({ where: { id: attachmentId } });
      await tx.auditEvent.create({
        data: auditData({
          actorUserId,
          entityType: "DOCUMENT_CONTROL_ATTACHMENT",
          entityId: attachmentId,
          action: "DOCUMENT_CONTROL_ATTACHMENT_REMOVED",
          beforeJson: meta,
          contextJson: { sessionId: meta.sessionId, category: meta.category },
        }),
      });
      return meta;
    });
  }
}
