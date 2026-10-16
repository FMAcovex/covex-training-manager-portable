import { measureTextWidth } from "@/annexes/pdf-font-metrics";
import { COVEX_LOGO_TEST } from "@/annexes/templates/covex-logo-test";

export type PdfCommands = string[];
export const pdfNumber = (value: number) => Number(value.toFixed(2));
const hexColor = (hex: string) => [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
const colorCommand = (hex: string, stroke = false) => `${hexColor(hex).map((value) => value.toFixed(3)).join(" ")} ${stroke ? "RG" : "rg"}`;
const pdfText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x00-\xff]/g, "?");

export function pdfFillRect(commands: PdfCommands, x: number, y: number, width: number, height: number, fill: string, border = "000000", lineWidth = 0.7) {
  commands.push("q", colorCommand(fill), colorCommand(border, true), `${lineWidth} w`, `${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re B`, "Q");
}

export function pdfStrokeRect(commands: PdfCommands, x: number, y: number, width: number, height: number, border = "000000", lineWidth = 0.7) {
  commands.push("q", colorCommand(border, true), `${lineWidth} w`, `${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re S`, "Q");
}

export function pdfDrawText(commands: PdfCommands, text: string, x: number, y: number, size: number, bold = false, color = "000000") {
  commands.push("BT", colorCommand(color), `/${bold ? "F2" : "F1"} ${size} Tf`, `1 0 0 1 ${pdfNumber(x)} ${pdfNumber(y)} Tm`, `(${pdfText(text)}) Tj`, "ET");
}

export function pdfCenteredText(commands: PdfCommands, text: string, x: number, y: number, width: number, size: number, bold = false, color = "000000") {
  pdfDrawText(commands, text, x + Math.max(3, (width - measureTextWidth(text, size, bold)) / 2), y, size, bold, color);
}

export function pdfRightText(commands: PdfCommands, text: string, right: number, y: number, size: number, bold = false, color = "000000") {
  pdfDrawText(commands, text, right - measureTextWidth(text, size, bold), y, size, bold, color);
}

export function pdfDrawLogo(commands: PdfCommands, x: number, y: number, width: number) {
  const height = width * COVEX_LOGO_TEST.height / COVEX_LOGO_TEST.width;
  commands.push("q", `${pdfNumber(width)} 0 0 ${pdfNumber(height)} ${pdfNumber(x)} ${pdfNumber(y)} cm`, "/Im1 Do", "Q");
  return height;
}

export function buildPdfDocument(streams: string[], width: number, height: number): Uint8Array {
  const firstPageObject = 6;
  const pageRefs = streams.map((_, index) => firstPageObject + index * 2);
  const objects = new Map<number, Buffer>();
  objects.set(1, Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"));
  objects.set(2, Buffer.from(`<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${streams.length} >>`, "latin1"));
  objects.set(3, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1"));
  objects.set(4, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1"));
  const logo = Buffer.from(COVEX_LOGO_TEST.jpegBase64, "base64");
  objects.set(5, Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${COVEX_LOGO_TEST.width} /Height ${COVEX_LOGO_TEST.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`, "latin1"), logo, Buffer.from("\nendstream", "latin1")]));
  streams.forEach((stream, index) => {
    const pageObject = firstPageObject + index * 2;
    const contentObject = pageObject + 1;
    const bytes = Buffer.from(stream, "latin1");
    objects.set(pageObject, Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents ${contentObject} 0 R >>`, "latin1"));
    objects.set(contentObject, Buffer.concat([Buffer.from(`<< /Length ${bytes.length} >>\nstream\n`, "latin1"), bytes, Buffer.from("\nendstream", "latin1")]));
  });
  const maxObject = 5 + streams.length * 2;
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1")];
  const offsets = Array(maxObject + 1).fill(0);
  let offset = chunks[0].length;
  for (let id = 1; id <= maxObject; id += 1) {
    offsets[id] = offset;
    const object = Buffer.concat([Buffer.from(`${id} 0 obj\n`, "latin1"), objects.get(id)!, Buffer.from("\nendobj\n", "latin1")]);
    chunks.push(object); offset += object.length;
  }
  const xrefOffset = offset;
  const xref = `xref\n0 ${maxObject + 1}\n0000000000 65535 f \n${offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n `).join("\n")}\n`;
  chunks.push(Buffer.from(xref + `trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, "latin1"));
  return new Uint8Array(Buffer.concat(chunks));
}
