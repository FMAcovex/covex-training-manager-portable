import type { DocumentControlAttachmentMeta, DocumentControlInput, DocumentControlState, DocumentStatus } from "./types";

export const emptyDocumentControl: DocumentControlInput = {
  signedAnnexIII: false,
  trainingMaterialArchived: false,
  evaluationEvidenceArchived: false,
  dossierPrinted: false,
  signedAnnexIIIReason: undefined,
  trainingMaterialReason: undefined,
  evaluationEvidenceReason: undefined,
};

const justified = (checked: boolean, reason?: string) => checked || Boolean(reason?.trim());

export function isDocumentControlClosureReady(control: DocumentControlInput) {
  return Boolean(control.dossierPrinted)
    && justified(control.signedAnnexIII, control.signedAnnexIIIReason)
    && justified(control.trainingMaterialArchived, control.trainingMaterialReason)
    && justified(control.evaluationEvidenceArchived, control.evaluationEvidenceReason);
}

export function calculateDocumentStatus(control: DocumentControlInput): DocumentStatus {
  if (!control.dossierPrinted) return "PRINT_PENDING";
  return isDocumentControlClosureReady(control) ? "CONFORMING" : "DOCUMENTATION_PENDING";
}
export function toDocumentControlState(
  control?: DocumentControlInput & { updatedByUserId?: string; updatedAt?: string },
  attachments: DocumentControlAttachmentMeta[] = [],
): DocumentControlState {
  const value = control ?? emptyDocumentControl;
  return { ...value, documentStatus: calculateDocumentStatus(value), attachments };
}
