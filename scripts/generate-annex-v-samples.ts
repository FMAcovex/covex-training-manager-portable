import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AnnexVDataBuilder } from "../src/annexes/annex-v-data-builder";
import { demoAnnexVTemplate } from "../src/annexes/annex-repository";
import { AnnexVTemplateAdapter } from "../src/annexes/annex-v-template-adapter";
import { AnnexVRenderer } from "../src/annexes/annex-v-renderer";
import { AnnexVDocumentValidator } from "../src/annexes/annex-v-validator";
import type { CurrentUser } from "../src/auth/current-user";
import type { Person } from "../src/domain/person";
import type { Training } from "../src/domain/training";
import type { Attendance, TrainingSession } from "../src/domain/training-session";
import { PersonHistoryService } from "../src/history/person-history-service";
import { InMemoryPeopleRepository } from "../src/server/people-repository";
import { InMemorySessionRepository } from "../src/server/session-repository";
import { InMemoryTrainingRepository } from "../src/server/training-repository";

type SampleRow = {
  executionDate: string;
  frequencyMonths?: number;
  result?: Attendance["result"];
  trainingName?: string;
  materialReference?: string;
  observations?: string;
};

const actor: CurrentUser = { id: "demo-user", displayName: "Usuario Demo", role: "ADMIN" };
const person: Person = { id: "person-demo", fullName: "Persona Ficticia de Demostración", personType: "INTERNAL", departmentId: "quality", jobTitle: "Técnico/a de demostración", active: true };
const timestamp = "2026-09-20T10:00:00.000Z";
const long = "WWWW Nombre y material extremadamente largo con ñ, acentos y observaciones completas ".repeat(5);

async function buildData(specs: SampleRow[]) {
  const trainings: Training[] = specs.map((spec, index) => ({
    id: `training-${index + 1}`,
    code: `FOR-2026-${String(index + 1).padStart(4, "0")}`,
    year: 2026,
    name: spec.trainingName ?? `Formación ficticia ${index + 1}`,
    planningType: "PLANNED",
    trainingTypeId: "type-quality",
    isGmp: false,
    originType: "INTERNAL",
    materialReference: spec.materialReference ?? `MAT-DEMO-${index + 1}`,
    frequencyMonths: spec.frequencyMonths,
    createdByUserId: actor.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  const sessions: TrainingSession[] = specs.map((spec, index) => {
    const sessionId = `session-${index + 1}`;
    const attendance: Attendance = {
      id: `attendance-${index + 1}`,
      sessionId,
      personId: person.id,
      attendanceStatus: "ATTENDED",
      result: spec.result ?? "PASS",
      notes: spec.observations,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return {
      id: sessionId,
      trainingId: trainings[index].id,
      code: `${trainings[index].code}-S01`,
      plannedDate: spec.executionDate,
      executionDate: spec.executionDate,
      trainerPersonId: person.id,
      durationMinutes: 60,
      executionStatus: "EXECUTED",
      createdAt: timestamp,
      updatedAt: timestamp,
      attendances: [attendance],
    };
  });
  const people = new InMemoryPeopleRepository([person]);
  const trainingRepository = new InMemoryTrainingRepository(trainings);
  const history = await new PersonHistoryService(trainingRepository, new InMemorySessionRepository(trainingRepository, people, sessions), people).get(person.id, actor, 2026, true);
  return new AnnexVDataBuilder().build(history, demoAnnexVTemplate);
}

const regularRows = (count: number): SampleRow[] => Array.from({ length: count }, (_, index) => ({ executionDate: `2026-05-${String((index % 27) + 1).padStart(2, "0")}`, frequencyMonths: 12 }));

async function main() {
  const examples = [
    ["anexo-v-corto.pdf", await buildData(regularRows(4))],
    ["anexo-v-no-apto.pdf", await buildData([{ executionDate: "2026-05-02", frequencyMonths: 12 }, { executionDate: "2026-05-03", frequencyMonths: 12, result: "FAIL", observations: "Requiere refuerzo ficticio" }, { executionDate: "2026-05-04", frequencyMonths: 12 }])],
    ["anexo-v-renovaciones.pdf", await buildData([
      { executionDate: "2026-02-10", frequencyMonths: 12, trainingName: "Suma normal de 12 meses" },
      { executionDate: "2026-11-15", frequencyMonths: 3, trainingName: "Cambio de año" },
      { executionDate: "2026-01-31", frequencyMonths: 1, trainingName: "Ajuste de final de mes" },
      { executionDate: "2026-04-10", frequencyMonths: 12, result: "FAIL", trainingName: "NO APTO sin renovación" },
      { executionDate: "2026-05-10", trainingName: "Frecuencia ausente sin renovación" },
    ])],
    ["anexo-v-multipagina.pdf", await buildData(regularRows(35))],
    ["anexo-v-textos-extremos.pdf", await buildData([{ executionDate: "2026-05-02", frequencyMonths: 12, trainingName: long, materialReference: long, observations: long }, { executionDate: "2026-05-03", frequencyMonths: 12, result: "FAIL", observations: long }])],
  ] as const;

  const output = resolve("tmp/annex-v-validation");
  await mkdir(output, { recursive: true });
  for (const [filename, input] of examples) {
    const plan = new AnnexVTemplateAdapter().createRenderPlan(input);
    const bytes = new AnnexVRenderer().render(plan);
    const result = new AnnexVDocumentValidator().validate(bytes, plan);
    await writeFile(resolve(output, filename), bytes);
    console.log(`${filename}: ${result.pageCount} página(s), ${result.rowCount} formaciones`);
  }
}

void main();
