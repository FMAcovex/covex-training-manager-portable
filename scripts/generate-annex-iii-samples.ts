import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { demoAnnexIIITemplate } from "../src/annexes/annex-repository";
import { AnnexIIIRH0000305TestAdapter } from "../src/annexes/annex-iii-template-adapter";
import { DocumentValidator } from "../src/annexes/document-validator";
import { PdfDocumentRenderer } from "../src/annexes/pdf-document-renderer";
import type { AnnexIIIData } from "../src/annexes/types";

const adapter = new AnnexIIIRH0000305TestAdapter();
const renderer = new PdfDocumentRenderer();
const validator = new DocumentValidator();
const outputDirectory = path.resolve("tmp", "annex-iii-validation");

function sample(attendees: number, longText = false, extreme = false): AnnexIIIData {
  return {
    templateVersion: demoAnnexIIITemplate,
    date: "20/09/2026",
    trainingName: longText ? "Formación ficticia con denominación extensa para comprobar el ajuste de los campos superiores" : "Formación ficticia de demostración",
    trainer: "Formador Ficticio",
    materialReference: "MAT-TEST-01",
    trainingType: "Tipo ficticio",
    modality: "Presencial",
    reason: "",
    targetGroup: "Colectivo ficticio de validación",
    content: extreme ? "WWW MMM Contenido ficticio extremo destinado a verificar medición tipográfica, paginación íntegra y conservación de bordes. ".repeat(180) : longText ? "Contenido ficticio destinado exclusivamente a comprobar el ajuste de línea y la conservación completa del borde derecho. ".repeat(18) : "Contenido ficticio para validación visual.",
    observations: extreme ? Array.from({ length: 20 }, (_, index) => `Línea ${index + 1}: WWW MMM observación ficticia de robustez.`).join("\n") : longText ? "Observaciones ficticias extensas para comprobar el ajuste de texto sin mezclar notas individuales de asistentes." : "Observación ficticia.",
    attendees: Array.from({ length: attendees }, (_, index) => ({
      number: index + 1,
      employeeName: longText ? `Persona Ficticia ${index + 1} con nombre compuesto de validación` : `Persona Ficticia ${index + 1}`,
      department: longText ? "Departamento Ficticio de Operaciones y Validación" : "Calidad Ficticia",
      jobTitle: longText ? "Especialista Ficticio/a en Procesos y Operaciones" : "Técnico/a",
      signature: "" as const,
      result: index % 3 === 0 ? "APTO" as const : index % 3 === 1 ? "NO APTO" as const : "" as const,
    })),
  };
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const definitions = [
    ["anexo-iii-corto.pdf", sample(3)],
    ["anexo-iii-textos-largos.pdf", sample(8, true)],
    ["anexo-iii-multipagina.pdf", sample(55)],
    ["anexo-iii-extremo.pdf", sample(24, true, true)],
  ] as const;
  const results = [];
  for (const [filename, data] of definitions) {
    const plan = adapter.createRenderPlan(data);
    const bytes = renderer.render(plan);
    const validation = validator.validatePdf(bytes, plan);
    await writeFile(path.join(outputDirectory, filename), bytes);
    results.push({ filename, ...validation });
  }
  if (results[0].pageCount !== 1) throw new Error("El ejemplo corto debe ocupar una página");
  if (results[2].pageCount <= 1) throw new Error("El ejemplo grande debe ocupar varias páginas");
  if (results[3].contentLineCount < 100 || results[3].observationLineCount !== 20 || results[3].maximumLineOverflow > 0.01) throw new Error("El ejemplo extremo no conserva íntegramente el contenido, las observaciones o los anchos");
  console.log(JSON.stringify({ outputDirectory, results }, null, 2));
}

void main();
