import { z } from "zod";

export type DocumentStatus = "PRINT_PENDING" | "DOCUMENTATION_PENDING" | "CONFORMING";

export const documentControlAttachmentCategorySchema = z.enum([
  "SIGNED_ANNEX_III",
  "TRAINING_MATERIAL",
  "EVALUATION_EVIDENCE",
]);
export type DocumentControlAttachmentCategory = z.infer<typeof documentControlAttachmentCategorySchema>;

export type DocumentControlAttachmentMeta = {
  id: string;
  documentControlId: string;
  sessionId: string;
  category: DocumentControlAttachmentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  createdAt: string;
};

export type DocumentControlAttachmentContent = DocumentControlAttachmentMeta & { content: Buffer };

export type DocumentControlAttachmentInput = {
  category: DocumentControlAttachmentCategory;
  fileName: string;
  mimeType: string;
  content: Buffer;
};

const optionalReason = z.string().trim().max(1000).optional().transform((value) => value || undefined);

export const documentControlInputSchema = z.object({
  signedAnnexIII: z.boolean(),
  trainingMaterialArchived: z.boolean(),
  evaluationEvidenceArchived: z.boolean(),
  dossierPrinted: z.boolean().default(false),
  signedAnnexIIIReason: optionalReason,
  trainingMaterialReason: optionalReason,
  evaluationEvidenceReason: optionalReason,
}).strict();

export type DocumentControlInput = Omit<z.infer<typeof documentControlInputSchema>, "dossierPrinted"> & {
  dossierPrinted?: boolean;
};

export type DocumentControl = DocumentControlInput & {
  id: string;
  sessionId: string;
  updatedByUserId: string;
  updatedAt: string;
};
export type DocumentControlState = DocumentControlInput & {
  documentStatus: DocumentStatus;
  updatedByUserId?: string;
  updatedAt?: string;
  attachments: DocumentControlAttachmentMeta[];
};
export type DocumentationRow = DocumentControlState & {
  sessionId: string;
  sessionCode: string;
  executionDate: string;
  trainingId: string;
  trainingCode: string;
  trainingName: string;
};
export type DocumentationFilters = {
  status?: DocumentStatus | "ALL";
  year?: number;
  search?: string;
  trainingId?: string;
};
