import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AnnualPlanService } from "../src/annual-plan/annual-plan-service";
import { AnnexIVDataBuilder } from "../src/annexes/annex-iv-data-builder";
import { demoAnnexIVTemplate } from "../src/annexes/annex-repository";
import { AnnexIVTemplateAdapter } from "../src/annexes/annex-iv-template-adapter";
import { AnnexIVRenderer } from "../src/annexes/annex-iv-renderer";
import { AnnexIVDocumentValidator } from "../src/annexes/annex-iv-validator";
import type { CurrentUser } from "../src/auth/current-user";
import type { Training } from "../src/domain/training";
import type { TrainingSession } from "../src/domain/training-session";
import { InMemoryPeopleRepository } from "../src/server/people-repository";
import { InMemorySessionRepository } from "../src/server/session-repository";
import { InMemoryTrainingRepository } from "../src/server/training-repository";

const actor: CurrentUser = { id: "demo-user", displayName: "Usuario Demo", role: "ADMIN" };
const timestamp = "2026-09-20T10:00:00.000Z";
const long = "WWW Formación extensa con caracteres españoles, ñ, acentos y colectivo de Producción y Calidad ".repeat(5);

const training = (index: number, partial: Partial<Training> = {}): Training => ({
  id: `training-${index}`,
  code: `FOR-2026-${String(index).padStart(4, "0")}`,
  year: 2026,
  name: `Formación ficticia ${index}`,
  planningType: "PLANNED",
  trainingTypeId: "type-quality",
  isGmp: index % 2 === 1,
  originType: index % 2 === 1 ? "INTERNAL" : "EXTERNAL",
  plannedDurationMinutes: 90,
  targetGroup: "Producción y Calidad",
  plannedTrainerPersonId: index % 2 === 1 ? "demo-1" : undefined,
  externalTrainerName: index % 2 === 0 ? "Formador/a ficticio/a" : undefined,
  createdByUserId: actor.id,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...partial,
});

const session = (index: number, item: Training, executionStatus: TrainingSession["executionStatus"], partial: Partial<TrainingSession> = {}): TrainingSession => ({
  id: `session-${index}`,
  trainingId: item.id,
  code: `${item.code}-S01`,
  plannedDate: `2026-05-${String((index % 27) + 1).padStart(2, "0")}`,
  executionDate: executionStatus === "EXECUTED" ? `2026-05-${String((index % 27) + 1).padStart(2, "0")}` : undefined,
  trainerPersonId: item.originType === "INTERNAL" ? "demo-1" : undefined,
  externalTrainerName: item.originType === "EXTERNAL" ? "Formador/a ficticio/a" : undefined,
  durationMinutes: 90,
  executionStatus,
  createdAt: timestamp,
  updatedAt: timestamp,
  attendances: [],
  ...partial,
});

async function buildData(trainings: Training[], sessions: TrainingSession[]) {
  const people = new InMemoryPeopleRepository();
  const trainingRepository = new InMemoryTrainingRepository(trainings);
  const service = new AnnualPlanService(trainingRepository, new InMemorySessionRepository(trainingRepository, people, sessions), people);
  return new AnnexIVDataBuilder().build(await service.get(2026, actor), demoAnnexIVTemplate);
}

async function main() {
  const shortTrainings = [training(1), training(2), training(3)];
  const shortUnplanned = training(101, { planningType: "UNPLANNED", reason: "Necesidad técnica ficticia" });
  const notExecuted = training(1);
  const multipagePlanned = Array.from({ length: 55 }, (_, index) => training(index + 1));
  const multipageUnplanned = Array.from({ length: 12 }, (_, index) => training(index + 101, { planningType: "UNPLANNED", reason: "Necesidad técnica ficticia" }));
  const longTraining = training(1, { name: long, targetGroup: long, originType: "EXTERNAL", plannedTrainerPersonId: undefined, externalTrainerName: long });

  const examples = [
    ["anexo-iv-corto.pdf", await buildData([...shortTrainings, shortUnplanned], [...shortTrainings.map((item, index) => session(index + 1, item, index < 2 ? "EXECUTED" : "PENDING")), session(101, shortUnplanned, "EXECUTED")])],
    ["anexo-iv-no-ejecutada.pdf", await buildData([notExecuted], [session(1, notExecuted, "NOT_EXECUTED", { nonExecutionReason: long })])],
    ["anexo-iv-multipagina.pdf", await buildData([...multipagePlanned, ...multipageUnplanned], [...multipagePlanned.map((item, index) => session(index + 1, item, index % 3 === 0 ? "EXECUTED" : "PENDING")), ...multipageUnplanned.map((item, index) => session(index + 101, item, "EXECUTED"))])],
    ["anexo-iv-textos-largos.pdf", await buildData([longTraining], [session(1, longTraining, "NOT_EXECUTED", { nonExecutionReason: long, externalTrainerName: long })])],
  ] as const;

  const output = resolve("tmp/annex-iv-validation");
  await mkdir(output, { recursive: true });
  for (const [filename, data] of examples) {
    const plan = new AnnexIVTemplateAdapter().createRenderPlan(data);
    const bytes = new AnnexIVRenderer().render(plan);
    const result = new AnnexIVDocumentValidator().validate(bytes, plan);
    await writeFile(resolve(output, filename), bytes);
    console.log(`${filename}: ${result.pageCount} página(s), ${result.plannedRows} planificadas, ${result.unplannedRows} no planificadas, ejecución ${data.summary.executionPercentage || "vacía"}`);
  }
}

void main();
