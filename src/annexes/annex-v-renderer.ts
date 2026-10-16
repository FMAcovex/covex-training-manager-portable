import type { AnnexVRenderPlan } from "@/annexes/annex-v-template-adapter";
import { buildPdfDocument, pdfCenteredText, pdfDrawLogo, pdfDrawText, pdfFillRect, pdfRightText, type PdfCommands } from "@/annexes/pdf-core";
import { wrapMeasuredText } from "@/annexes/pdf-font-metrics";

export class AnnexVRenderer {
  render(plan: AnnexVRenderPlan) {
    return buildPdfDocument(plan.pages.map((page) => {
      const c: PdfCommands = [];
      if (page.first) this.fullHeader(c, plan);
      this.table(c, plan, page.tableTop, page.rows);
      if (page.last) this.responsible(c, plan, page.tableTop - plan.template.tableHeaderHeight - page.rows.reduce((sum, row) => sum + row.height, 0) - 8);
      pdfRightText(c, `${page.pageNumber} de ${plan.pages.length}`, plan.template.page.width - plan.template.page.margins.right, plan.template.page.margins.bottom - 4, 7, false, "595959");
      return c.join("\n");
    }), plan.template.page.width, plan.template.page.height);
  }

  private fullHeader(c: PdfCommands, plan: AnnexVRenderPlan) {
    const { template, data } = plan;
    const left = template.page.margins.left;
    const right = template.page.width - template.page.margins.right;
    const width = right - left;
    const top = template.page.height - template.page.margins.top;
    pdfFillRect(c, left, top - 52, 105, 52, template.colors.white, template.colors.navy, 1);
    pdfDrawLogo(c, left + 8, top - 44, 89);
    pdfFillRect(c, left + 105, top - 52, width - 105, 32, template.colors.navy, template.colors.navy, 1);
    pdfCenteredText(c, template.fixedText.title, left + 105, top - 41, width - 105, 11, true, template.colors.white);
    pdfFillRect(c, right - 210, top - 20, 210, 20, template.colors.paleBlue, template.colors.navy, 1);
    pdfCenteredText(c, template.fixedText.reference, right - 210, top - 14, 210, 7.3, true, template.colors.navy);
    const fields = [["AÑO", String(data.year)], ["Empleado", data.employee], ["Total formaciones asistidas", String(data.totalAttended)], ["Departamento", data.department], ["Puesto", data.jobTitle]];
    let y = top - 59;
    fields.forEach(([label, value], index) => {
      const x = index === 0 ? left : index === 1 ? left + 150 : index === 2 ? left + 520 : index === 3 ? left : left + 390;
      if (index === 3) y = top - 91;
      pdfDrawText(c, `${label}:`, x, y, 7.5, true, template.colors.navy);
      const available = (index === 1 ? 330 : index === 3 ? 320 : 210);
      wrapMeasuredText(value, available, 7.5).forEach((line, lineIndex) => pdfDrawText(c, line, x + (index === 0 ? 38 : index === 2 ? 132 : 76), y - lineIndex * 9, 7.5));
    });
  }

  private table(c: PdfCommands, plan: AnnexVRenderPlan, top: number, rows: AnnexVRenderPlan["pages"][number]["rows"]) {
    const { template } = plan;
    let x = template.page.margins.left;
    template.fixedText.headers.forEach((header, index) => {
      const width = template.columnWidths[index];
      pdfFillRect(c, x, top - template.tableHeaderHeight, width, template.tableHeaderHeight, template.colors.navy, template.colors.border);
      wrapMeasuredText(header, width - 6, 6.5, true).forEach((line, lineIndex) => pdfCenteredText(c, line, x, top - 12 - lineIndex * 8, width, 6.5, true, template.colors.white));
      x += width;
    });
    let cursor = top - template.tableHeaderHeight;
    rows.forEach((row, rowIndex) => {
      x = template.page.margins.left;
      row.cells.forEach((cell, index) => {
        const width = template.columnWidths[index];
        pdfFillRect(c, x, cursor - row.height, width, row.height, rowIndex % 2 ? template.colors.paleBlue : template.colors.white, template.colors.border);
        cell.lines.forEach((line, lineIndex) => pdfDrawText(c, line, x + 4, cursor - 12 - lineIndex * template.lineHeight, 7.2));
        x += width;
      });
      cursor -= row.height;
    });
  }

  private responsible(c: PdfCommands, plan: AnnexVRenderPlan, top: number) {
    const { template } = plan;
    const left = template.page.margins.left;
    const width = template.page.width - left - template.page.margins.right;
    pdfFillRect(c, left, top - template.responsibleHeight, 180, template.responsibleHeight, template.colors.teal, template.colors.border);
    pdfFillRect(c, left + 180, top - template.responsibleHeight, width - 180, template.responsibleHeight, template.colors.paleYellow, template.colors.border);
    pdfDrawText(c, template.fixedText.responsible, left + 6, top - 24, 7.5, true, template.colors.white);
  }
}
