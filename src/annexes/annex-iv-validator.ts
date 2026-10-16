import type { AnnexIVRenderPlan } from "@/annexes/annex-iv-template-adapter";
import { InvalidGeneratedDocumentError } from "@/annexes/document-validator";

export class AnnexIVDocumentValidator {
  validate(bytes: Uint8Array, plan: AnnexIVRenderPlan) {
    const source = Buffer.from(bytes).toString("latin1");
    if (!source.startsWith("%PDF-") || bytes.length < 100) throw new InvalidGeneratedDocumentError("El Anexo IV generado no es un PDF válido");
    const pageCount = (source.match(/\/Type \/Page\b/g) ?? []).length;
    if (pageCount !== plan.pages.length) throw new InvalidGeneratedDocumentError("El Anexo IV no contiene el número de páginas esperado");
    if (plan.renderedPlannedRows !== plan.plannedRowCount || plan.renderedUnplannedRows !== plan.unplannedRowCount) throw new InvalidGeneratedDocumentError("El Anexo IV ha perdido filas");
    if (plan.renderedObservationLines !== plan.observationLines.length) throw new InvalidGeneratedDocumentError("Las observaciones del Anexo IV se han truncado");
    if (plan.maximumOverflow > 0.01) throw new InvalidGeneratedDocumentError("Hay texto que desborda una celda del Anexo IV");
    const { width, height, margins } = plan.template.page;
    for (const page of plan.pages) for (const region of page.regions) if (region.left < margins.left - .01 || region.right > width - margins.right + .01 || region.top > height - margins.top + .01 || region.bottom < margins.bottom - .01) throw new InvalidGeneratedDocumentError(`La región ${region.name} sale del área imprimible`);
    if (!plan.template.fixedText.reference.includes("RH-00/003/05")) throw new InvalidGeneratedDocumentError("Falta la referencia del PNT en el Anexo IV");
    return { pageCount, plannedRows: plan.plannedRowCount, unplannedRows: plan.unplannedRowCount, observationLines: plan.observationLines.length, maximumOverflow: plan.maximumOverflow };
  }
}
