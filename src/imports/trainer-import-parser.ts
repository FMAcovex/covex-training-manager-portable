import { inflateRawSync } from "node:zlib";

export type SourceTrainerQualification = {
  trainerName: string;
  authorizedSubject: string;
  evidence: string;
  qualifiedFrom: string;
  qualifiedTo?: string;
  personType: "INTERNAL" | "EXTERNAL";
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const xmlText = (xml: string) => normalize(
  [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"))
    .join(" "),
);

function findDocumentXml(buffer: Buffer) {
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index--) {
    if (buffer.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error("El DOCX no contiene un directorio ZIP válido");
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("El DOCX contiene un directorio ZIP no válido");
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    if (fileName === "word/document.xml") {
      if (uncompressedSize > 20 * 1024 * 1024) throw new Error("El DOCX contiene un documento interno demasiado grande");
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("El DOCX contiene una entrada local no válida");
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (compression === 0) return compressed.toString("utf8");
      if (compression === 8) return inflateRawSync(compressed, { maxOutputLength: 20 * 1024 * 1024 }).toString("utf8");
      throw new Error("El DOCX usa un método de compresión no soportado");
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error("El DOCX no contiene word/document.xml");
}

function parseDate(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const match = normalized.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) throw new Error(`${field} no tiene formato dd/mm/aaaa: ${value}`);
  const [, day, month, year] = match;
  const result = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(result + "T00:00:00.000Z");
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== result) throw new Error(`${field} no es una fecha válida: ${value}`);
  return result;
}

function tableRows(xml: string) {
  return [...xml.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)].map((rowMatch) => {
    const rowXml = rowMatch[0];
    return [...rowXml.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)].map((cellMatch) => {
      const cellXml = cellMatch[0];
      const merge = /<w:vMerge(?:\s[^>]*)?\/>/.test(cellXml) || /<w:vMerge(?:\s[^>]*)?>[\s\S]*?<\/w:vMerge>/.test(cellXml);
      const restart = /<w:vMerge[^>]*w:val=["']restart["']/.test(cellXml);
      return { text: xmlText(cellXml), merge, restart };
    });
  });
}

export function parseTrainerQualificationDocx(buffer: Buffer): SourceTrainerQualification[] {
  const xml = findDocumentXml(buffer);
  const rows = tableRows(xml);
  const headerIndex = rows.findIndex((row) => {
    const joined = row.map((cell) => cell.text.toLocaleUpperCase("es")).join("|");
    return joined.includes("FORMADOR CUALIFICADO") && joined.includes("MATERIA") && joined.includes("EVIDENCIA") && joined.includes("FECHA DE ALTA");
  });
  if (headerIndex < 0) throw new Error("No se ha encontrado la tabla del Anexo III de formadores cualificados");

  const carry: Array<string | undefined> = Array(6).fill(undefined);
  const result: SourceTrainerQualification[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (row.length < 6) continue;
    const values = row.slice(0, 6).map((cell, index) => {
      if (cell.text) {
        if (cell.restart || cell.merge || index === 0 || index === 2 || index === 5) carry[index] = cell.text;
        return cell.text;
      }
      if (cell.merge || index === 0 || index === 2 || index === 5) return carry[index] ?? "";
      return "";
    });
    const [trainerName, authorizedSubject, evidence, highDate, lowDate, type] = values;
    if (!trainerName || !authorizedSubject || !highDate) continue;
    if (/Aprobado por/i.test(trainerName) || /Responsable de Formación/i.test(trainerName)) continue;
    const normalizedType = normalize(type).toLocaleUpperCase("es");
    if (normalizedType !== "INTERNO" && normalizedType !== "EXTERNO") {
      throw new Error(`Tipo de formador no reconocido para ${trainerName}: ${type || "(vacío)"}`);
    }
    result.push({
      trainerName,
      authorizedSubject,
      evidence,
      qualifiedFrom: parseDate(highDate, "Fecha de alta")!,
      qualifiedTo: parseDate(lowDate, "Fecha de baja"),
      personType: normalizedType === "INTERNO" ? "INTERNAL" : "EXTERNAL",
    });
  }
  if (result.length === 0) throw new Error("La tabla no contiene líneas de cualificación");
  return result;
}

export function normalizeTrainerName(value: string) {
  return normalize(value).toLocaleLowerCase("es");
}
