const HELVETICA_WIDTHS: Record<string, number> = {
  " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556, "8": 556, "9": 556,
  ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  "{": 334, "|": 260, "}": 334, "~": 584,
};

const HELVETICA_BOLD_OVERRIDES: Record<string, number> = {
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556, K: 722, L: 611, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278, k: 556, l: 278, m: 889,
  n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500,
};

const BASE_CHARACTER: Record<string, string> = {
  á: "a", à: "a", ä: "a", â: "a", Á: "A", À: "A", Ä: "A", Â: "A",
  é: "e", è: "e", ë: "e", ê: "e", É: "E", È: "E", Ë: "E", Ê: "E",
  í: "i", ì: "i", ï: "i", î: "i", Í: "I", Ì: "I", Ï: "I", Î: "I",
  ó: "o", ò: "o", ö: "o", ô: "o", Ó: "O", Ò: "O", Ö: "O", Ô: "O",
  ú: "u", ù: "u", ü: "u", û: "u", Ú: "U", Ù: "U", Ü: "U", Û: "U",
  ñ: "n", Ñ: "N", ç: "c", Ç: "C", "º": "o", "ª": "a",
};

export function measureTextWidth(text: string, fontSize: number, bold = false): number {
  return [...text].reduce((total, raw) => {
    const character = BASE_CHARACTER[raw] ?? raw;
    const width = (bold ? HELVETICA_BOLD_OVERRIDES[character] : undefined) ?? HELVETICA_WIDTHS[character] ?? 600;
    return total + width * fontSize / 1000;
  }, 0);
}

function splitToken(token: string, width: number, fontSize: number, bold: boolean): string[] {
  const parts: string[] = [];
  let current = "";
  for (const character of token) {
    const candidate = current + character;
    if (current && measureTextWidth(candidate, fontSize, bold) > width) {
      parts.push(current);
      current = character;
    } else current = candidate;
  }
  if (current) parts.push(current);
  return parts;
}

export function wrapMeasuredText(text: string, width: number, fontSize: number, bold = false): string[] {
  if (width <= 0) throw new Error("El ancho disponible para el texto debe ser positivo");
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(""); continue; }
    let current = "";
    for (const word of words) {
      const pieces = measureTextWidth(word, fontSize, bold) <= width ? [word] : splitToken(word, width, fontSize, bold);
      for (const piece of pieces) {
        const candidate = current ? `${current} ${piece}` : piece;
        if (current && measureTextWidth(candidate, fontSize, bold) > width) {
          lines.push(current);
          current = piece;
        } else current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}
