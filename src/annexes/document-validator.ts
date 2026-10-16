import { maximumLineOverflow, type AnnexIIIRenderPlan } from "@/annexes/annex-iii-template-adapter";

export class InvalidGeneratedDocumentError extends Error {}

export class DocumentValidator {
  validatePdf(bytes: Uint8Array, plan: AnnexIIIRenderPlan) {
    if (bytes.length < 100) throw new InvalidGeneratedDocumentError("El PDF generado está vacío");
    const source = Buffer.from(bytes).toString("latin1");
    if (!source.startsWith("%PDF-")) throw new InvalidGeneratedDocumentError("La salida generada no es un PDF válido");
    const pageCount = (source.match(/\/Type \/Page\b/g) ?? []).length;
    if (pageCount !== plan.pages.length) throw new InvalidGeneratedDocumentError("El PDF no contiene el número de páginas esperado");
    if (!source.includes(`/MediaBox [0 0 ${plan.template.page.width} ${plan.template.page.height}]`)) throw new InvalidGeneratedDocumentError("El PDF no tiene el tamaño de página esperado");
    if (plan.attendeeCount !== plan.renderedNumbers.length) throw new InvalidGeneratedDocumentError("No se han procesado todos los asistentes");
    if (plan.renderedNumbers.some((number, index) => number !== index + 1)) throw new InvalidGeneratedDocumentError("La numeración de asistentes no es continua");
    if (plan.renderedContentLineCount !== plan.contentLines.length) throw new InvalidGeneratedDocumentError("El contenido de la formación ha quedado truncado");
    if (plan.renderedObservationLineCount !== plan.observationLines.length) throw new InvalidGeneratedDocumentError("Las observaciones han quedado truncadas");
    const { width, height, margins } = plan.template.page;
    for (const page of plan.pages) {
      if (plan.attendeeCount > 0 && page.kind === "ATTENDEES" && page.rows.length === 0) throw new InvalidGeneratedDocumentError("Existe una página de asistentes sin ninguna fila");
      for (const region of page.regions) {
        if (region.left < margins.left - 0.01 || region.right > width - margins.right + 0.01 || region.top > height - margins.top + 0.01 || region.bottom < margins.bottom - 0.01 || region.left > region.right || region.bottom > region.top) {
          throw new InvalidGeneratedDocumentError(`La región ${region.name} de la página ${page.pageNumber} sale del área imprimible`);
        }
      }
    }
    if (maximumLineOverflow(plan) > 0.01) throw new InvalidGeneratedDocumentError("Hay texto que desborda el ancho de su celda");
    if (!plan.template.fixedText.annexReference.includes("RH-00/003/05")) throw new InvalidGeneratedDocumentError("Falta la referencia del PNT en la plantilla");
    if (!plan.template.fixedText.content || !plan.template.fixedText.attendeeHeaders.includes("Apto /No Apto")) throw new InvalidGeneratedDocumentError("Faltan textos fijos esenciales en la plantilla");
    return { pageCount, attendeeCount: plan.attendeeCount, contentLineCount: plan.contentLines.length, observationLineCount: plan.observationLines.length, maximumLineOverflow: maximumLineOverflow(plan) };
  }
}
