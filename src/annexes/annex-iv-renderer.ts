import type { AnnexIVRenderPlan, AnnexIVSummaryBlock, AnnexIVTableBlock } from "@/annexes/annex-iv-template-adapter";
import { buildPdfDocument, pdfCenteredText, pdfDrawLogo, pdfDrawText, pdfFillRect, pdfRightText, type PdfCommands } from "@/annexes/pdf-core";
import { wrapMeasuredText } from "@/annexes/pdf-font-metrics";

export class AnnexIVRenderer {
  render(plan: AnnexIVRenderPlan) {
    return buildPdfDocument(plan.pages.map((page) => {
      const commands: PdfCommands = [];
      this.header(commands, plan);
      for (const block of page.blocks) {
        if (block.kind === "SUMMARY") this.summary(commands, plan, block);
        else this.table(commands, plan, block);
      }
      pdfRightText(commands, `${page.pageNumber} de ${plan.pages.length}`, plan.template.page.width - plan.template.page.margins.right, plan.template.page.margins.bottom - 4, 7, false, "595959");
      return commands.join("\n");
    }), plan.template.page.width, plan.template.page.height);
  }

  private header(c: PdfCommands, plan: AnnexIVRenderPlan) {
    const { template, data } = plan;
    const left = template.page.margins.left;
    const right = template.page.width - template.page.margins.right;
    const top = template.page.height - template.page.margins.top;
    pdfFillRect(c, left, top - 54, 105, 54, template.colors.white, template.colors.navy, 1);
    pdfDrawLogo(c, left + 8, top - 46, 89);
    pdfFillRect(c, left + 105, top - 54, right - left - 105, 34, template.colors.navy, template.colors.navy, 1);
    pdfCenteredText(c, template.fixedText.title, left + 105, top - 43, right - left - 105, 12, true, template.colors.white);
    pdfFillRect(c, right - 210, top - 20, 210, 20, template.colors.paleBlue, template.colors.navy, 1);
    pdfCenteredText(c, template.fixedText.reference, right - 210, top - 14, 210, 7.3, true, template.colors.navy);
    pdfDrawText(c, `AÑO DEL PLAN: ${data.year}`, left, top - 67, 8.5, true, template.colors.navy);
    pdfDrawText(c, `FECHA DE EMISIÓN INICIAL: ${data.initialIssueDate}`, left + 250, top - 67, 8.5, true, template.colors.navy);
  }

  private table(c: PdfCommands, plan: AnnexIVRenderPlan, block: AnnexIVTableBlock) {
    const { template } = plan;
    const left = template.page.margins.left;
    const title = block.kind === "PLANNED" ? template.fixedText.planned : template.fixedText.unplanned;
    const headers = block.kind === "PLANNED" ? template.fixedText.plannedHeaders : template.fixedText.unplannedHeaders;
    let cursor = block.top;
    pdfFillRect(c, left, cursor - template.sectionTitleHeight, template.page.width - template.page.margins.left - template.page.margins.right, template.sectionTitleHeight, template.colors.teal, template.colors.border);
    pdfDrawText(c, title, left + 5, cursor - 13, 8, true, template.colors.white);
    cursor -= template.sectionTitleHeight;
    let x = left;
    headers.forEach((header, index) => {
      const width = template.columnWidths[index];
      pdfFillRect(c, x, cursor - template.tableHeaderHeight, width, template.tableHeaderHeight, template.colors.navy, template.colors.border);
      const lines = wrapMeasuredText(header, width - 6, 6.6, true);
      lines.forEach((line, lineIndex) => pdfCenteredText(c, line, x, cursor - 12 - lineIndex * 8, width, 6.6, true, template.colors.white));
      x += width;
    });
    cursor -= template.tableHeaderHeight;
    block.rows.forEach((row, rowIndex) => {
      x = left;
      row.cells.forEach((cell, index) => {
        const width = template.columnWidths[index];
        pdfFillRect(c, x, cursor - row.height, width, row.height, rowIndex % 2 ? template.colors.paleBlue : template.colors.white, template.colors.border);
        cell.lines.forEach((line, lineIndex) => pdfDrawText(c, line, x + 4, cursor - 12 - lineIndex * template.lineHeight, 7.2));
        x += width;
      });
      cursor -= row.height;
    });
  }

  private summary(c: PdfCommands, plan: AnnexIVRenderPlan, block: AnnexIVSummaryBlock) {
    const { template, data } = plan;
    const left = template.page.margins.left;
    const width = template.page.width - left - template.page.margins.right;
    let cursor = block.top;
    pdfFillRect(c, left, cursor - 20, width, 20, template.colors.teal, template.colors.border);
    pdfDrawText(c, block.first ? template.fixedText.summary : `${template.fixedText.summary} — OBSERVACIONES (continuación)`, left + 5, cursor - 14, 8, true, template.colors.white);
    cursor -= 20;
    if (block.first) {
      const fields = [
        ["Total formaciones planificadas:", String(data.summary.totalPlanned)],
        ["Planificadas ejecutadas:", String(data.summary.plannedExecuted)],
        ["% ejecución planificadas:", data.summary.executionPercentage],
        ["No planificadas ejecutadas:", String(data.summary.unplannedExecuted)],
        ["Última actualización:", data.summary.lastUpdated],
        ["Pendientes planificadas:", String(data.summary.pendingPlanned)],
      ];
      fields.forEach(([label, value], index) => { const x = left + (index % 2) * width / 2; const y = cursor - Math.floor(index / 2) * 18; pdfDrawText(c, label, x + 5, y - 12, 7.5, true); pdfDrawText(c, value, x + 175, y - 12, 7.5); });
      cursor -= 58;
      pdfDrawText(c, "Se han impartido todas las formaciones planificadas:", left + 5, cursor - 12, 7.5, true);
      pdfDrawText(c, data.summary.allPlannedDelivered, left + 245, cursor - 12, 7.5, true);
      pdfDrawText(c, "Han sido efectivas todas las formaciones:", left + width / 2, cursor - 12, 7.5, true);
      pdfDrawText(c, data.summary.effectiveness, left + width / 2 + 220, cursor - 12, 7.5, true);
      cursor -= 27;
    }
    pdfFillRect(c, left, cursor - 20 - block.observationLines.length * template.lineHeight, 115, 20 + block.observationLines.length * template.lineHeight, template.colors.teal, template.colors.border);
    pdfFillRect(c, left + 115, cursor - 20 - block.observationLines.length * template.lineHeight, width - 115, 20 + block.observationLines.length * template.lineHeight, template.colors.paleYellow, template.colors.border);
    pdfDrawText(c, "OBSERVACIONES:", left + 5, cursor - 14, 7.5, true, template.colors.white);
    block.observationLines.forEach((line, index) => pdfDrawText(c, line, left + 120, cursor - 14 - index * template.lineHeight, 8));
    cursor -= 20 + block.observationLines.length * template.lineHeight;
    if (block.last) {
      pdfFillRect(c, left, cursor - 42, 115, 42, template.colors.teal, template.colors.border);
      pdfFillRect(c, left + 115, cursor - 42, width - 115, 42, template.colors.paleYellow, template.colors.border);
      pdfDrawText(c, "FIRMA Y FECHA:", left + 5, cursor - 23, 7.5, true, template.colors.white);
    }
  }
}
