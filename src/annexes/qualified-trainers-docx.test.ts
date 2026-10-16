import { describe, expect, it } from "vitest";
import { renderQualifiedTrainersDocx } from "@/annexes/qualified-trainers-docx";
import type { TrainerQualification } from "@/domain/trainer";

const rows: TrainerQualification[] = [
  {
    id: "q1",
    personId: "p1",
    person: { id: "p1", fullName: "Formador Demo", personType: "INTERNAL", active: true },
    authorizedSubject: "CONTROL DE CALIDAD",
    evidence: "Evidencia demo",
    qualifiedFrom: "2026-06-11",
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    current: true,
  },
  {
    id: "q2",
    personId: "p1",
    person: { id: "p1", fullName: "Formador Demo", personType: "INTERNAL", active: true },
    authorizedSubject: "GARANTÍA DE CALIDAD",
    evidence: "Evidencia demo",
    qualifiedFrom: "2026-06-11",
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    current: true,
  },
  {
    id: "q3",
    personId: "p2",
    person: { id: "p2", fullName: "Entidad Externa Demo", personType: "EXTERNAL", active: true },
    authorizedSubject: "FARMACOVIGILANCIA",
    evidence: "Evaluación como proveedor",
    qualifiedFrom: "2026-06-11",
    qualifiedTo: "2026-12-31",
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    current: true,
  },
];

const readStoredEntries = (buffer: Buffer) => {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compression = buffer.readUInt16LE(offset + 8);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    expect(compression).toBe(0);
    entries.set(name, buffer.subarray(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
};

describe("Anexo III de formadores cualificados en Word", () => {
  it("genera un DOCX con portada, tabla oficial y bloque de aprobación", () => {
    const document = renderQualifiedTrainersDocx(rows);
    expect(document.subarray(0, 4).toString("binary")).toBe("PK\x03\x04");
    const entries = readStoredEntries(document);
    expect(entries.has("word/document.xml")).toBe(true);
    expect(entries.has("word/header1.xml")).toBe(true);
    expect(entries.has("word/footer1.xml")).toBe(true);
    expect(entries.has("word/media/covex-logo.jpg")).toBe(true);

    const xml = entries.get("word/document.xml")!.toString("utf8");
    expect(xml).toContain("LISTADO DE FORMADORES CUALIFICADOS");
    expect(xml).toContain("FORMADOR CUALIFICADO");
    expect(xml).toContain("MATERIA /");
    expect(xml).toContain("EVIDENCIA DE");
    expect(xml).toContain("FECHA DE");
    expect(xml).toContain("INTERNO /");
    expect(xml).toContain("Formador Demo");
    expect(xml).toContain("Entidad Externa Demo");
    expect(xml).toContain("31/12/2026");
    expect(xml).toContain("Aprobado por:");
    expect(xml).toContain('w:vMerge w:val="restart"');
    expect(xml).toContain("<w:tblHeader/>");
  });
});
