import type { AnnexVData, AnnexVRow } from "@/annexes/types";
import { measureTextWidth, wrapMeasuredText } from "@/annexes/pdf-font-metrics";
import { ANNEX_V_TEMPLATE as template } from "@/annexes/templates/rh-00-003-05-annex-v-test";
import type { RenderRegion } from "@/annexes/annex-iii-template-adapter";

export type AnnexVCell = { text: string; lines: string[]; width: number };
export type AnnexVRenderRow = { cells: AnnexVCell[]; height: number };
export type AnnexVRenderPage = { pageNumber: number; first: boolean; last: boolean; tableTop: number; rows: AnnexVRenderRow[]; regions: RenderRegion[] };
export type AnnexVRenderPlan = { template: typeof template; data: AnnexVData; pages: AnnexVRenderPage[]; rowCount: number; renderedRowCount: number; maximumOverflow: number };

export class AnnexVTemplateAdapter {
  supports(reference: string) { return reference === "fixture://annex-v/rh-00-003-05-test-v1"; }

  createRenderPlan(data: AnnexVData): AnnexVRenderPlan {
    if (!this.supports(data.templateVersion.storageReference)) throw new Error("No existe un adaptador para la versión de Anexo V seleccionada");
    const rows = data.rows.map((row) => this.row(row));
    const pages: AnnexVRenderPage[] = [];
    let index = 0;
    do {
      const first = pages.length === 0;
      const tableTop = template.page.height - template.page.margins.top - (first ? template.firstHeaderHeight : template.continuationHeaderHeight);
      const bottom = template.page.margins.bottom + 12 + template.responsibleHeight;
      let cursor = tableTop - template.tableHeaderHeight;
      const pageRows: AnnexVRenderRow[] = [];
      while (index < rows.length && cursor - rows[index].height >= bottom) { pageRows.push(rows[index]); cursor -= rows[index].height; index += 1; }
      if (index < rows.length && pageRows.length === 0) throw new Error("Una fila del Anexo V no cabe dentro del área imprimible");
      const page: AnnexVRenderPage = { pageNumber: pages.length + 1, first, last: false, tableTop, rows: pageRows, regions: [] };
      page.regions.push({ name: "encabezado-tabla", left: template.page.margins.left, right: template.page.width - template.page.margins.right, top: tableTop, bottom: tableTop - template.tableHeaderHeight });
      let regionCursor = tableTop - template.tableHeaderHeight;
      pageRows.forEach((row, rowIndex) => { page.regions.push({ name: `fila-${rowIndex + 1}`, left: template.page.margins.left, right: template.page.width - template.page.margins.right, top: regionCursor, bottom: regionCursor - row.height }); regionCursor -= row.height; });
      pages.push(page);
    } while (index < rows.length || pages.length === 0);
    pages[pages.length - 1].last = true;
    const last = pages[pages.length - 1];
    const lastBottom = last.rows.reduce((cursor, row) => cursor - row.height, last.tableTop - template.tableHeaderHeight);
    last.regions.push({ name: "responsable", left: template.page.margins.left, right: template.page.width - template.page.margins.right, top: lastBottom - 8, bottom: lastBottom - 8 - template.responsibleHeight });
    const cells = pages.flatMap((page) => page.rows.flatMap((row) => row.cells));
    return { template, data, pages, rowCount: rows.length, renderedRowCount: pages.reduce((sum, page) => sum + page.rows.length, 0), maximumOverflow: Math.max(0, ...cells.flatMap((cell) => cell.lines.map((line) => measureTextWidth(line, 7.2) - cell.width))) };
  }

  private row(row: AnnexVRow): AnnexVRenderRow {
    const values = [row.training, row.date, row.type, row.materialReference, row.status, row.result, row.renewalDate, row.observations];
    const cells = values.map((text, index) => ({ text, lines: wrapMeasuredText(text, template.columnWidths[index] - 8, 7.2), width: template.columnWidths[index] - 8 }));
    return { cells, height: Math.max(template.minimumRowHeight, ...cells.map((cell) => cell.lines.length * template.lineHeight + 8)) };
  }
}
