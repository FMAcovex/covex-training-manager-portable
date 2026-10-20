import { describe, expect, it } from "vitest";
import { pdfText, PdfTextEncodingError } from "./pdf-text";
import { pdfDrawText } from "./pdf-core";

describe("PDF text integrity A13", () => {
  it("preserves Spanish identity and normalizes decomposed accents", () => {
    expect(pdfText("Muñoz, María · a\u0301" )).toBe("Muñoz, María · á");
  });
  it("encodes WinAnsi symbols without changing the controlled font", () => {
    expect(pdfText("€–•")).toBe("\x80\x96\x95");
    expect(pdfText("(texto)\\")).toBe("\\(texto\\)\\\\");
  });
  it.each(["Łukasz", "漢字", "Persona 😀", "Texto\u0081"])("rejects unsupported text before emitting a PDF: %s", (text) => {
    expect(() => pdfText(text)).toThrow(PdfTextEncodingError);
    expect(() => pdfDrawText([], text, 0, 0, 10)).toThrow("los datos originales se conservan");
  });
});
