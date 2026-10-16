import type { AnnexIVData, AnnexIVPlannedRow, AnnexIVUnplannedRow } from "@/annexes/types";
import { wrapMeasuredText, measureTextWidth } from "@/annexes/pdf-font-metrics";
import { ANNEX_IV_TEMPLATE as template } from "@/annexes/templates/rh-00-003-05-annex-iv-test";
import type { RenderRegion } from "@/annexes/annex-iii-template-adapter";

export type AnnexIVCell = { text: string; lines: string[]; width: number };
export type AnnexIVRenderRow = { cells: AnnexIVCell[]; height: number };
export type AnnexIVTableBlock = { kind: "PLANNED" | "UNPLANNED"; rows: AnnexIVRenderRow[]; top: number; height: number };
export type AnnexIVSummaryBlock = { kind: "SUMMARY"; top: number; height: number; first: boolean; last: boolean; observationLines: string[] };
export type AnnexIVBlock = AnnexIVTableBlock | AnnexIVSummaryBlock;
export type AnnexIVRenderPage = { pageNumber: number; blocks: AnnexIVBlock[]; regions: RenderRegion[] };
export type AnnexIVRenderPlan = { template: typeof template; data: AnnexIVData; pages: AnnexIVRenderPage[]; plannedRowCount: number; unplannedRowCount: number; renderedPlannedRows: number; renderedUnplannedRows: number; observationLines: string[]; renderedObservationLines: number; maximumOverflow: number };

export class AnnexIVTemplateAdapter {
  supports(reference: string) { return reference === "fixture://annex-iv/rh-00-003-05-test-v1"; }

  createRenderPlan(data: AnnexIVData): AnnexIVRenderPlan {
    if (!this.supports(data.templateVersion.storageReference)) throw new Error("No existe un adaptador para la versión de Anexo IV seleccionada");
    const pages: AnnexIVRenderPage[] = [];
    const bodyTop = template.page.height - template.page.margins.top - template.headerHeight - 6;
    const bodyBottom = template.page.margins.bottom + 12;
    const newPage = () => { const page = { pageNumber: pages.length + 1, blocks: [], regions: [] } as AnnexIVRenderPage; pages.push(page); return page; };
    let page = newPage();
    let cursor = bodyTop;
    const addTable = (kind: "PLANNED" | "UNPLANNED", sourceRows: (AnnexIVPlannedRow | AnnexIVUnplannedRow)[]) => {
      const rows = sourceRows.map((row) => this.row(kind, row));
      let index = 0;
      do {
        const heading = template.sectionTitleHeight + template.tableHeaderHeight;
        if (cursor - heading < bodyBottom || (index < rows.length && cursor - heading - rows[index].height < bodyBottom)) { page = newPage(); cursor = bodyTop; }
        const top = cursor;
        cursor -= heading;
        const blockRows: AnnexIVRenderRow[] = [];
        while (index < rows.length && cursor - rows[index].height >= bodyBottom) { blockRows.push(rows[index]); cursor -= rows[index].height; index += 1; }
        if (index < rows.length && blockRows.length === 0) throw new Error("Una fila del Anexo IV no cabe en el área imprimible");
        const block: AnnexIVTableBlock = { kind, rows: blockRows, top, height: top - cursor };
        page.blocks.push(block);
        page.regions.push({ name: `${kind.toLowerCase()}-${page.pageNumber}`, left: template.page.margins.left, right: template.page.width - template.page.margins.right, top, bottom: cursor });
        if (index < rows.length) { page = newPage(); cursor = bodyTop; }
      } while (index < rows.length);
      cursor -= 8;
    };
    addTable("PLANNED", data.planned);
    addTable("UNPLANNED", data.unplannedExecuted);

    const observationText = data.observations.length ? data.observations.join("\n") : "";
    const observationLines = wrapMeasuredText(observationText, template.page.width - template.page.margins.left - template.page.margins.right - 120, 8);
    if (observationLines.length === 1 && observationLines[0] === "") observationLines.length = 0;
    const firstFixed = 137;
    const continuationFixed = 45;
    const signature = 42;
    let observationIndex = 0;
    let first = true;
    do {
      const fixed = first ? firstFixed : continuationFixed;
      const requiredMinimum = fixed + (observationIndex < observationLines.length ? template.lineHeight : 0) + signature;
      if (cursor - requiredMinimum < bodyBottom) { page = newPage(); cursor = bodyTop; }
      const availableLines = Math.max(0, Math.floor((cursor - bodyBottom - fixed - signature) / template.lineHeight));
      const remaining = observationLines.length - observationIndex;
      let take = Math.min(remaining, availableLines);
      let last = observationIndex + take >= observationLines.length;
      if (!last && take === 0) throw new Error("Las observaciones del Anexo IV no caben en el área imprimible");
      if (!last && take > 0) {
        const continuationCapacity = Math.max(1, Math.floor((bodyTop - bodyBottom - continuationFixed - signature) / template.lineHeight));
        if (remaining - take <= continuationCapacity && take > 1) take -= 1;
        last = observationIndex + take >= observationLines.length;
      }
      const lines = observationLines.slice(observationIndex, observationIndex + take);
      observationIndex += take;
      last = observationIndex >= observationLines.length;
      const height = fixed + lines.length * template.lineHeight + (last ? signature : 0);
      const block: AnnexIVSummaryBlock = { kind: "SUMMARY", top: cursor, height, first, last, observationLines: lines };
      page.blocks.push(block);
      page.regions.push({ name: `summary-${page.pageNumber}`, left: template.page.margins.left, right: template.page.width - template.page.margins.right, top: cursor, bottom: cursor - height });
      cursor -= height;
      first = false;
      if (!last) { page = newPage(); cursor = bodyTop; }
    } while (observationIndex < observationLines.length || first);

    const cellLines = pages.flatMap((item) => item.blocks.flatMap((block) => block.kind === "SUMMARY" ? [] : block.rows.flatMap((row) => row.cells.flatMap((cell) => cell.lines.map((line) => ({ line, width: cell.width }))))));
    return {
      template, data, pages,
      plannedRowCount: data.planned.length,
      unplannedRowCount: data.unplannedExecuted.length,
      renderedPlannedRows: pages.flatMap((item) => item.blocks).filter((block): block is AnnexIVTableBlock => block.kind === "PLANNED").reduce((sum, block) => sum + block.rows.length, 0),
      renderedUnplannedRows: pages.flatMap((item) => item.blocks).filter((block): block is AnnexIVTableBlock => block.kind === "UNPLANNED").reduce((sum, block) => sum + block.rows.length, 0),
      observationLines,
      renderedObservationLines: pages.flatMap((item) => item.blocks).filter((block): block is AnnexIVSummaryBlock => block.kind === "SUMMARY").reduce((sum, block) => sum + block.observationLines.length, 0),
      maximumOverflow: Math.max(0, ...cellLines.map(({ line, width }) => measureTextWidth(line, 7.2) - width)),
    };
  }

  private row(kind: "PLANNED" | "UNPLANNED", row: AnnexIVPlannedRow | AnnexIVUnplannedRow): AnnexIVRenderRow {
    const values = kind === "PLANNED"
      ? [row.course, row.gmp, row.origin, row.durationHours, row.targetGroup, row.plannedDate, row.executionDate, row.trainer, (row as AnnexIVPlannedRow).status]
      : [row.course, row.gmp, row.origin, row.durationHours, row.targetGroup, row.plannedDate, row.executionDate, row.trainer, (row as AnnexIVUnplannedRow).reason];
    const cells = values.map((text, index) => ({ text, lines: wrapMeasuredText(text, template.columnWidths[index] - 8, 7.2), width: template.columnWidths[index] - 8 }));
    return { cells, height: Math.max(template.minimumRowHeight, ...cells.map((cell) => cell.lines.length * template.lineHeight + 8)) };
  }
}
