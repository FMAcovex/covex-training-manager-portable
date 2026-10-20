import type { AnnexIIIRenderPage, AnnexIIIRenderPlan, RenderAttendeeRow } from "@/annexes/annex-iii-template-adapter";
import { measureTextWidth } from "@/annexes/pdf-font-metrics";
import { COVEX_LOGO_TEST } from "@/annexes/templates/covex-logo-test";
import { buildPdfDocument } from "@/annexes/pdf-core";
import { pdfText } from "@/annexes/pdf-text";

type PdfPageCommands = string[];
const number = (value: number) => Number(value.toFixed(2));
const hexColor = (hex: string) => [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
const colorCommand = (hex: string, stroke = false) => `${hexColor(hex).map((value) => value.toFixed(3)).join(" ")} ${stroke ? "RG" : "rg"}`;

function fillRect(commands: PdfPageCommands, x: number, y: number, width: number, height: number, fill: string, border: string, lineWidth = 0.7) {
  commands.push("q", colorCommand(fill), colorCommand(border, true), `${lineWidth} w`, `${number(x)} ${number(y)} ${number(width)} ${number(height)} re B`, "Q");
}
function strokeRect(commands: PdfPageCommands, x: number, y: number, width: number, height: number, border: string, lineWidth = 0.7) {
  commands.push("q", colorCommand(border, true), `${lineWidth} w`, `${number(x)} ${number(y)} ${number(width)} ${number(height)} re S`, "Q");
}
function drawText(commands: PdfPageCommands, text: string, x: number, y: number, size: number, bold = false, color = "000000") {
  commands.push("BT", colorCommand(color), `/${bold ? "F2" : "F1"} ${size} Tf`, `1 0 0 1 ${number(x)} ${number(y)} Tm`, `(${pdfText(text)}) Tj`, "ET");
}
function centeredText(commands: PdfPageCommands, text: string, x: number, y: number, width: number, size: number, bold = false, color = "000000") {
  const textWidth = measureTextWidth(text, size, bold);
  drawText(commands, text, x + Math.max(3, (width - textWidth) / 2), y, size, bold, color);
}
function rightAlignedText(commands: PdfPageCommands, text: string, right: number, y: number, size: number, bold = false, color = "000000") {
  drawText(commands, text, right - measureTextWidth(text, size, bold), y, size, bold, color);
}

export class PdfDocumentRenderer {
  render(plan: AnnexIIIRenderPlan): Uint8Array {
    return buildPdfDocument(plan.pages.map((page) => this.renderPage(plan, page)), plan.template.page.width, plan.template.page.height);
  }

  private renderPage(plan: AnnexIIIRenderPlan, page: AnnexIIIRenderPage): string {
    const { template } = plan;
    const c: string[] = [];
    const left = template.page.margins.left;
    const width = template.page.width - left - template.page.margins.right;
    this.renderHeader(c, plan, left, width);
    if (page.showDetails) this.renderUpperBlock(c, plan, page, left);
    else if (page.kind === "CONTENT_CONTINUATION") this.renderContentContinuation(c, plan, page, left, width);
    if (page.showTable && page.tableTop !== undefined) {
      let cursor = this.renderTableHeader(c, plan, left, page.tableTop);
      for (const row of page.rows) cursor = this.renderAttendeeRow(c, plan, row, left, cursor);
      if (page.showFooter) this.renderFooter(c, plan, left, cursor, width);
    }
    rightAlignedText(c, `${page.pageNumber} de ${plan.pages.length}`, left + width, template.page.margins.bottom + 3, 7, false, "595959");
    return c.join("\n");
  }

  private renderHeader(c: string[], plan: AnnexIIIRenderPlan, left: number, width: number) {
    const { template } = plan;
    const top = template.page.height - template.page.margins.top;
    const logoWidth = 100;
    const referenceHeight = 20;
    const referenceWidth = template.attendeeColumnWidths[4] + template.attendeeColumnWidths[5];
    const visualHeight = 62;
    fillRect(c, left, top - visualHeight, logoWidth, visualHeight, template.colors.white, template.colors.navy, 1);
    const imageWidth = 88;
    const imageHeight = imageWidth * COVEX_LOGO_TEST.height / COVEX_LOGO_TEST.width;
    const imageX = left + (logoWidth - imageWidth) / 2;
    const imageY = top - visualHeight + (visualHeight - imageHeight) / 2;
    c.push("q", `${number(imageWidth)} 0 0 ${number(imageHeight)} ${number(imageX)} ${number(imageY)} cm`, "/Im1 Do", "Q");
    fillRect(c, left + width - referenceWidth, top - referenceHeight, referenceWidth, referenceHeight, template.colors.paleBlue, template.colors.navy, 1);
    centeredText(c, template.fixedText.annexReference, left + width - referenceWidth, top - 14, referenceWidth, 7.2, true, template.colors.navy);
    fillRect(c, left + logoWidth, top - visualHeight, width - logoWidth, visualHeight - referenceHeight, template.colors.navy, template.colors.navy, 1);
    centeredText(c, template.fixedText.title, left + logoWidth, top - referenceHeight - 26, width - logoWidth, 10, true, template.colors.white);
  }

  private renderUpperBlock(c: string[], plan: AnnexIIIRenderPlan, page: AnnexIIIRenderPage, left: number) {
    const { template, detailLines, detailHeights } = plan;
    let cursor = page.bodyTop;
    for (let index = 0; index < detailLines.length; index += 1) {
      const height = detailHeights[index];
      fillRect(c, left, cursor - height, template.detailLabelWidth, height, template.colors.teal, template.colors.border);
      fillRect(c, left + template.detailLabelWidth, cursor - height, template.detailColumnWidth - template.detailLabelWidth, height, template.colors.paleBlue, template.colors.border);
      plan.detailLabelLines[index].forEach((line, lineIndex) => drawText(c, line, left + 4, cursor - 11 - lineIndex * 8, 7.2, true, template.colors.white));
      detailLines[index].forEach((line, lineIndex) => drawText(c, line, left + template.detailLabelWidth + 4, cursor - 14 - lineIndex * template.lineHeight, 8));
      cursor -= height;
    }
    const contentX = left + template.detailColumnWidth;
    fillRect(c, contentX, page.bodyTop - template.tableHeaderHeight, template.contentColumnWidth, template.tableHeaderHeight, template.colors.teal, template.colors.border);
    centeredText(c, template.fixedText.content, contentX, page.bodyTop - 17, template.contentColumnWidth, 8, true, template.colors.white);
    fillRect(c, contentX, page.bodyTop - plan.detailHeight, template.contentColumnWidth, plan.detailHeight - template.tableHeaderHeight, template.colors.paleYellow, template.colors.border);
    page.contentLines.forEach((line, index) => drawText(c, line, contentX + 5, page.bodyTop - template.tableHeaderHeight - 13 - index * template.lineHeight, 8));
    strokeRect(c, contentX, page.bodyTop - plan.detailHeight, template.contentColumnWidth, plan.detailHeight, template.colors.border, 0.8);
  }

  private renderContentContinuation(c: string[], plan: AnnexIIIRenderPlan, page: AnnexIIIRenderPage, left: number, width: number) {
    const { template } = plan;
    const height = template.tableHeaderHeight + 10 + page.contentLines.length * template.lineHeight;
    fillRect(c, left, page.bodyTop - template.tableHeaderHeight, width, template.tableHeaderHeight, template.colors.teal, template.colors.border);
    centeredText(c, template.fixedText.content, left, page.bodyTop - 17, width, 8, true, template.colors.white);
    fillRect(c, left, page.bodyTop - height, width, height - template.tableHeaderHeight, template.colors.paleYellow, template.colors.border);
    page.contentLines.forEach((line, index) => drawText(c, line, left + 5, page.bodyTop - template.tableHeaderHeight - 13 - index * template.lineHeight, 8));
  }

  private renderTableHeader(c: string[], plan: AnnexIIIRenderPlan, left: number, top: number) {
    let x = left;
    plan.attendeeHeaderLines.forEach((headerLines, index) => {
      const width = plan.template.attendeeColumnWidths[index];
      fillRect(c, x, top - plan.template.tableHeaderHeight, width, plan.template.tableHeaderHeight, plan.template.colors.navy, plan.template.colors.border);
      headerLines.forEach((line, lineIndex) => centeredText(c, line, x, top - 13 - lineIndex * 9, width, 7.5, true, plan.template.colors.white));
      x += width;
    });
    return top - plan.template.tableHeaderHeight;
  }

  private renderAttendeeRow(c: string[], plan: AnnexIIIRenderPlan, row: RenderAttendeeRow, left: number, top: number) {
    let x = left;
    row.cells.forEach((cell, index) => {
      const width = plan.template.attendeeColumnWidths[index];
      const fill = index >= 4 ? plan.template.colors.paleYellow : (row.number % 2 === 0 ? plan.template.colors.paleBlue : plan.template.colors.white);
      fillRect(c, x, top - row.height, width, row.height, fill, plan.template.colors.border);
      cell.lines.forEach((line, lineIndex) => {
        if (index === 0 || index >= 4) centeredText(c, line, x, top - 14 - lineIndex * 10, width, cell.fontSize);
        else drawText(c, line, x + 4, top - 14 - lineIndex * 10, cell.fontSize);
      });
      x += width;
    });
    return top - row.height;
  }

  private renderFooter(c: string[], plan: AnnexIIIRenderPlan, left: number, top: number, width: number) {
    const { template } = plan;
    fillRect(c, left, top - template.observationLabelHeight, template.observationLabelWidth, template.observationLabelHeight, template.colors.teal, template.colors.border);
    fillRect(c, left, top - plan.observationHeight, template.observationLabelWidth, plan.observationHeight - template.observationLabelHeight, template.colors.white, template.colors.border);
    fillRect(c, left + template.observationLabelWidth, top - plan.observationHeight, width - template.observationLabelWidth, plan.observationHeight, template.colors.paleYellow, template.colors.border);
    plan.observationLabelLines.forEach((line, index) => drawText(c, line, left + 4, top - 11 - index * 8, 7.2, true, template.colors.white));
    plan.observationLines.forEach((line, index) => drawText(c, line, left + template.observationLabelWidth + 5, top - 14 - index * template.lineHeight, 8));
    top -= plan.observationHeight + 8;
    fillRect(c, left, top - 42, template.responsibleLabelWidth, 42, template.colors.teal, template.colors.border);
    fillRect(c, left + template.responsibleLabelWidth, top - 42, width - template.responsibleLabelWidth, 42, template.colors.paleYellow, template.colors.border);
    plan.responsibleLabelLines.forEach((line, index) => drawText(c, line, left + 4, top - 22 - index * 9, 7.5, true, template.colors.white));
  }

}
