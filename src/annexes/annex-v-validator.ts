import type { AnnexVRenderPlan } from "@/annexes/annex-v-template-adapter";
import { InvalidGeneratedDocumentError } from "@/annexes/document-validator";

export class AnnexVDocumentValidator {
  validate(bytes: Uint8Array, plan: AnnexVRenderPlan) {
    const source = Buffer.from(bytes).toString("latin1");
    if (!source.startsWith("%PDF-") || bytes.length < 100) throw new InvalidGeneratedDocumentError("El Anexo V generado no es un PDF válido");
    const pageCount = (source.match(/\/Type \/Page\b/g) ?? []).length;
    if (pageCount !== plan.pages.length) throw new InvalidGeneratedDocumentError("El Anexo V no contiene el número de páginas esperado");
    if (plan.renderedRowCount !== plan.rowCount) throw new InvalidGeneratedDocumentError("El Anexo V ha perdido filas");
    if (plan.maximumOverflow > .01) throw new InvalidGeneratedDocumentError("Hay texto que desborda una celda del Anexo V");
    const { width, height, margins } = plan.template.page;
    for (const page of plan.pages) for (const region of page.regions) if (region.left < margins.left - .01 || region.right > width - margins.right + .01 || region.top > height - margins.top + .01 || region.bottom < margins.bottom - .01) throw new InvalidGeneratedDocumentError(`La región ${region.name} sale del área imprimible`);
    if (!plan.template.fixedText.reference.includes("RH-00/003/05")) throw new InvalidGeneratedDocumentError("Falta la referencia del PNT en el Anexo V");
    if (plan.template.fixedText.headers.includes("ID sesión" as never)) throw new InvalidGeneratedDocumentError("El ID de sesión no debe imprimirse en el Anexo V");
    return { pageCount, rowCount: plan.rowCount, maximumOverflow: plan.maximumOverflow };
  }
}
