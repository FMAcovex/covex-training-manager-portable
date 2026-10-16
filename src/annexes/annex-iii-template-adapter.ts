import type { AnnexIIIData, AnnexIIIAttendeeRow } from "@/annexes/types";
import { measureTextWidth, wrapMeasuredText } from "@/annexes/pdf-font-metrics";
import { RH_00_003_05_TEST_TEMPLATE as template } from "@/annexes/templates/rh-00-003-05-test";

export type RenderText = { text: string; lines: string[]; fontSize: number; width: number; bold?: boolean };
export type RenderAttendeeRow = AnnexIIIAttendeeRow & { height: number; cells: RenderText[] };
export type RenderRegion = { name: string; left: number; right: number; top: number; bottom: number };
export type AnnexIIIRenderPage = {
  pageNumber: number;
  kind: "FIRST" | "CONTENT_CONTINUATION" | "ATTENDEES";
  first: boolean;
  last: boolean;
  showDetails: boolean;
  showTable: boolean;
  showFooter: boolean;
  bodyTop: number;
  tableTop?: number;
  contentLines: string[];
  rows: RenderAttendeeRow[];
  regions: RenderRegion[];
};
export type AnnexIIIRenderPlan = {
  template: typeof template;
  data: AnnexIIIData;
  pages: AnnexIIIRenderPage[];
  contentLines: string[];
  observationLines: string[];
  detailLines: string[][];
  detailLabelLines: string[][];
  attendeeHeaderLines: string[][];
  observationLabelLines: string[];
  responsibleLabelLines: string[];
  detailHeights: number[];
  detailHeight: number;
  observationHeight: number;
  footerHeight: number;
  attendeeCount: number;
  renderedNumbers: number[];
  renderedContentLineCount: number;
  renderedObservationLineCount: number;
};

export const wrapText = wrapMeasuredText;

export class AnnexIIIRH0000305TestAdapter {
  supports(storageReference: string) { return storageReference === "fixture://annex-iii/rh-00-003-05-test-v1"; }

  createRenderPlan(data: AnnexIIIData): AnnexIIIRenderPlan {
    if (!this.supports(data.templateVersion.storageReference)) throw new Error("No existe un adaptador para la versión de plantilla seleccionada");
    const margins = template.page.margins;
    const printableWidth = template.page.width - margins.left - margins.right;
    const bodyTop = template.page.height - margins.top - template.headerHeight - 8;
    const bodyBottom = margins.bottom + 14;
    const detailValueWidth = template.detailColumnWidth - template.detailLabelWidth - 8;
    const detailLabels = ["Fecha:", "Nombre formación:", "Formador:", "Versión material/PNT:", "Tipo:", "Presencial/Online:", "Motivo:", "Colectivo objetivo:"];
    const detailLabelLines = detailLabels.map((label) => label === "Presencial/Online:" ? ["Presencial/", "Online:"] : wrapText(label, template.detailLabelWidth - 8, 7.2, true));
    const attendeeHeaderLines = template.fixedText.attendeeHeaders.map((label, index) => wrapText(label, template.attendeeColumnWidths[index] - 8, 7.5, true));
    const observationLabelLines = wrapText(template.fixedText.observations, template.observationLabelWidth - 8, 7.2, true);
    const responsibleLabelLines = wrapText(template.fixedText.responsible, template.responsibleLabelWidth - 8, 7.5, true);
    const detailValues = [data.date, data.trainingName, data.trainer, data.materialReference, data.trainingType, data.modality, data.reason, data.targetGroup];
    const detailLines = detailValues.map((value) => wrapText(value, detailValueWidth, 8));
    const detailHeights = detailLines.map((lines, index) => Math.max(template.detailMinimumHeights[index], lines.length * template.lineHeight + 8, detailLabelLines[index].length * 8 + 8));
    const detailHeight = detailHeights.reduce((sum, height) => sum + height, 0);
    if (bodyTop - detailHeight < bodyBottom) throw new Error("Los datos superiores del Anexo III no caben dentro del área imprimible");

    const contentLines = wrapText(data.content, template.contentColumnWidth - 10, 8);
    const observationTextWidth = printableWidth - template.observationLabelWidth - 10;
    const observationLines = wrapText(data.observations, observationTextWidth, 8);
    const observationHeight = Math.max(62, observationLines.length * template.lineHeight + 16);
    const footerHeight = observationHeight + 8 + 42;
    if (footerHeight > bodyTop - bodyBottom) throw new Error("Las observaciones del Anexo III no caben en una página imprimible");

    const rows = data.attendees.map((attendee) => this.adaptAttendee(attendee));
    const fullAttendeePageHeight = bodyTop - bodyBottom;
    if (rows.some((row) => template.tableHeaderHeight + row.height + footerHeight > fullAttendeePageHeight)) {
      throw new Error("Una fila de asistentes no puede representarse junto al pie dentro del área imprimible");
    }
    const pages: AnnexIIIRenderPage[] = [];
    const firstContentCapacity = Math.max(0, Math.floor((detailHeight - template.tableHeaderHeight - 10) / template.lineHeight));
    let contentCursor = Math.min(firstContentCapacity, contentLines.length);
    const firstPage = this.newPage(1, "FIRST", bodyTop, true);
    firstPage.contentLines = contentLines.slice(0, contentCursor);
    this.addRegion(firstPage, "datos", margins.left, bodyTop, margins.left + template.detailColumnWidth, bodyTop - detailHeight);
    this.addRegion(firstPage, "contenido", margins.left + template.detailColumnWidth, bodyTop, margins.left + printableWidth, bodyTop - detailHeight);
    pages.push(firstPage);

    while (contentCursor < contentLines.length) {
      const page = this.newPage(pages.length + 1, "CONTENT_CONTINUATION", bodyTop, false);
      const capacity = Math.max(1, Math.floor((bodyTop - bodyBottom - template.tableHeaderHeight - 10) / template.lineHeight));
      page.contentLines = contentLines.slice(contentCursor, contentCursor + capacity);
      contentCursor += page.contentLines.length;
      const height = template.tableHeaderHeight + 10 + page.contentLines.length * template.lineHeight;
      this.addRegion(page, "contenido-continuación", margins.left, bodyTop, margins.left + printableWidth, bodyTop - height);
      pages.push(page);
    }

    let rowCursor = 0;
    const contentOverflowed = pages.length > 1;
    let activePage: AnnexIIIRenderPage | undefined = contentOverflowed ? undefined : firstPage;
    do {
      if (!activePage) {
        activePage = this.newPage(pages.length + 1, "ATTENDEES", bodyTop, false);
        pages.push(activePage);
      }
      const tableTop = activePage.first || activePage.kind === "FIRST" ? bodyTop - detailHeight - 10 : bodyTop;
      activePage.tableTop = tableTop;
      activePage.showTable = true;
      const available = tableTop - bodyBottom;
      const remainingRows = rows.slice(rowCursor);
      const remainingHeight = remainingRows.reduce((sum, row) => sum + row.height, 0);
      if (template.tableHeaderHeight + remainingHeight + footerHeight <= available) {
        activePage.rows = remainingRows;
        rowCursor = rows.length;
        activePage.showFooter = true;
      } else {
        let used = template.tableHeaderHeight;
        while (rowCursor < rows.length && used + rows[rowCursor].height <= available) {
          activePage.rows.push(rows[rowCursor]);
          used += rows[rowCursor].height;
          rowCursor += 1;
        }
        if (rowCursor === rows.length && rows.length > 0) {
          const rowForFooterPage = activePage.rows.pop();
          if (!rowForFooterPage) throw new Error("No se puede reservar una fila para acompañar al pie del Anexo III");
          rowCursor -= 1;
        }
        if (activePage.rows.length === 0 && rowCursor < rows.length) {
          if (activePage.kind === "FIRST") {
            activePage.showTable = false;
            activePage.tableTop = undefined;
          } else throw new Error("Una fila de asistentes no cabe dentro del área imprimible");
        }
      }
      if (activePage.showTable) this.addTableRegions(activePage, tableTop, bodyBottom, footerHeight);
      if (rowCursor < rows.length || !activePage.showFooter) activePage = undefined;
    } while (rowCursor < rows.length || !pages.some((page) => page.showFooter));

    pages.forEach((page, index) => { page.pageNumber = index + 1; page.first = index === 0; page.last = index === pages.length - 1; });
    return {
      template, data, pages, contentLines, observationLines, detailLines, detailLabelLines, attendeeHeaderLines, observationLabelLines, responsibleLabelLines, detailHeights, detailHeight, observationHeight, footerHeight,
      attendeeCount: data.attendees.length,
      renderedNumbers: pages.flatMap((page) => page.rows.map((row) => row.number)),
      renderedContentLineCount: pages.reduce((sum, page) => sum + page.contentLines.length, 0),
      renderedObservationLineCount: pages.some((page) => page.showFooter) ? observationLines.length : 0,
    };
  }

  private newPage(pageNumber: number, kind: AnnexIIIRenderPage["kind"], bodyTop: number, showDetails: boolean): AnnexIIIRenderPage {
    const { margins } = template.page;
    const page: AnnexIIIRenderPage = { pageNumber, kind, first: false, last: false, showDetails, showTable: false, showFooter: false, bodyTop, contentLines: [], rows: [], regions: [] };
    this.addRegion(page, "cabecera", margins.left, template.page.height - margins.top, template.page.width - margins.right, bodyTop + 8);
    return page;
  }

  private addTableRegions(page: AnnexIIIRenderPage, tableTop: number, bodyBottom: number, footerHeight: number) {
    const { margins } = template.page;
    const right = template.page.width - margins.right;
    this.addRegion(page, "cabecera-asistentes", margins.left, tableTop, right, tableTop - template.tableHeaderHeight);
    let cursor = tableTop - template.tableHeaderHeight;
    page.rows.forEach((row, index) => { this.addRegion(page, `asistente-${index + 1}`, margins.left, cursor, right, cursor - row.height); cursor -= row.height; });
    if (page.showFooter) this.addRegion(page, "pie", margins.left, cursor, right, cursor - footerHeight);
    if (cursor - (page.showFooter ? footerHeight : 0) < bodyBottom - 0.01) throw new Error("La paginación ha salido del área imprimible");
  }

  private addRegion(page: AnnexIIIRenderPage, name: string, left: number, top: number, right: number, bottom: number) {
    page.regions.push({ name, left, right, top, bottom });
  }

  private adaptAttendee(attendee: AnnexIIIAttendeeRow): RenderAttendeeRow {
    const values = [String(attendee.number), attendee.employeeName, attendee.department, attendee.jobTitle, attendee.signature, attendee.result];
    const cells = values.map((value, index) => {
      const width = template.attendeeColumnWidths[index] - 8;
      return { text: value, lines: wrapText(value, width, 8), fontSize: 8, width };
    });
    const height = Math.max(template.attendeeMinimumHeight, ...cells.map((cell) => cell.lines.length * 10 + 8));
    return { ...attendee, height, cells };
  }
}

export function maximumLineOverflow(plan: AnnexIIIRenderPlan): number {
  const detailValueWidth = template.detailColumnWidth - template.detailLabelWidth - 8;
  const widths = [
    ...plan.detailLines.flatMap((lines) => lines.map((line) => measureTextWidth(line, 8) - detailValueWidth)),
    ...plan.detailLabelLines.flatMap((lines) => lines.map((line) => measureTextWidth(line, 7.2, true) - (template.detailLabelWidth - 8))),
    ...plan.attendeeHeaderLines.flatMap((lines, index) => lines.map((line) => measureTextWidth(line, 7.5, true) - (template.attendeeColumnWidths[index] - 8))),
    ...plan.observationLabelLines.map((line) => measureTextWidth(line, 7.2, true) - (template.observationLabelWidth - 8)),
    ...plan.responsibleLabelLines.map((line) => measureTextWidth(line, 7.5, true) - (template.responsibleLabelWidth - 8)),
    ...plan.contentLines.map((line) => measureTextWidth(line, 8) - (template.contentColumnWidth - 10)),
    ...plan.observationLines.map((line) => measureTextWidth(line, 8) - (template.page.width - template.page.margins.left - template.page.margins.right - template.observationLabelWidth - 10)),
    ...plan.pages.flatMap((page) => page.rows.flatMap((row) => row.cells.flatMap((cell) => cell.lines.map((line) => measureTextWidth(line, cell.fontSize, cell.bold) - cell.width)))),
  ];
  return Math.max(0, ...widths);
}
