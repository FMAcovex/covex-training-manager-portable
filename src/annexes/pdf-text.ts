/** Preserve the approved Helvetica/WinAnsi template; never replace a person's identity silently. */
export class PdfTextEncodingError extends Error {
  constructor(character: string) {
    super(`El PDF no puede representar el carácter «${character}» (U+${character.codePointAt(0)!.toString(16).toUpperCase()}) con la tipografía vigente. Requiere una plantilla Unicode aprobada por Calidad; los datos originales se conservan.`);
  }
}

const winAnsi = new Map<string, number>([
  ["€", 0x80], ["‚", 0x82], ["ƒ", 0x83], ["„", 0x84], ["…", 0x85], ["†", 0x86], ["‡", 0x87],
  ["ˆ", 0x88], ["‰", 0x89], ["Š", 0x8a], ["‹", 0x8b], ["Œ", 0x8c], ["Ž", 0x8e],
  ["‘", 0x91], ["’", 0x92], ["“", 0x93], ["”", 0x94], ["•", 0x95], ["–", 0x96], ["—", 0x97],
  ["˜", 0x98], ["™", 0x99], ["š", 0x9a], ["›", 0x9b], ["œ", 0x9c], ["ž", 0x9e], ["Ÿ", 0x9f],
]);

export function pdfText(value: string): string {
  let encoded = "";
  for (const character of value.normalize("NFC")) {
    const point = character.codePointAt(0)!;
    const byte = winAnsi.get(character) ?? ((point >= 0x20 && point <= 0x7e) || (point >= 0xa0 && point <= 0xff) ? point : undefined);
    if (byte === undefined) throw new PdfTextEncodingError(character);
    encoded += [0x28, 0x29, 0x5c].includes(byte) ? `\\${String.fromCharCode(byte)}` : String.fromCharCode(byte);
  }
  return encoded;
}
