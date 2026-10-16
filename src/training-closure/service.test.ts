import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/auth/current-user";
import { validateFinalizeSession, validateSessionInput } from "@/domain/training-session";
import { validateTraining } from "@/domain/training";
import { InMemoryDocumentControlRepository } from "@/document-control/repository";
import { InMemoryPeopleRepository } from "@/server/people-repository";
import { InMemorySessionRepository } from "@/server/session-repository";
import { InMemoryTrainingRepository } from "@/server/training-repository";
import { TrainingClosureNotReadyError, TrainingClosureService } from "./service";

const responsible: CurrentUser = { id: "responsible", displayName: "Responsable", role: "RESPONSIBLE" };

async function setup() {
  const trainings = new InMemoryTrainingRepository([]);
  const training = await trainings.create(validateTraining({
    year: 2026,
    name: "Formacion documental ficticia",
    planningType: "PLANNED",
    isGmp: false,
    originType: "EXTERNAL",
    externalTrainerName: "Entidad ficticia",
  }), responsible.id);
  const people = new InMemoryPeopleRepository();
  const sessions = new InMemorySessionRepository(trainings, people, []);
  const session = await sessions.create(validateSessionInput({
    trainingId: training.id,
    plannedDate: "2026-10-01",
    externalTrainerName: "Entidad ficticia",
    durationMinutes: 60,
    attendeePersonIds: ["demo-2"],
  }), responsible);
  await sessions.finalize(session.id, validateFinalizeSession({ executionDate: "2026-10-01", initializeDefaults: true }), responsible);
  const controls = new InMemoryDocumentControlRepository([]);
  return { trainings, training, sessions, session, controls, service: new TrainingClosureService(trainings, sessions, controls) };
}

describe("cierre documental de formacion", () => {
  it("bloquea cierre mientras la impresion esta pendiente", async () => {
    const { training, service } = await setup();
    const state = await service.evaluate(training.id);
    expect(state?.ready).toBe(false);
    expect(state?.blockingReasons.some((reason) => reason.includes("control documental"))).toBe(true);
    await expect(service.close(training.id, responsible)).rejects.toBeInstanceOf(TrainingClosureNotReadyError);
  });

  it("considera conforme un control impreso con ausencias justificadas", async () => {
    const { training, session, controls, service } = await setup();
    await controls.upsert(session.id, {
      signedAnnexIII: true,
      trainingMaterialArchived: false,
      trainingMaterialReason: "No existe material separado",
      evaluationEvidenceArchived: false,
      evaluationEvidenceReason: "Formacion sin evaluacion",
      dossierPrinted: true,
    }, responsible);
    const state = await service.evaluate(training.id);
    expect(state).toMatchObject({ ready: true, closed: false, blockingReasons: [] });
  });

  it("cierra y reabre sin cambiar el estado de ejecucion", async () => {
    const { training, session, controls, sessions, service } = await setup();
    await controls.upsert(session.id, {
      signedAnnexIII: true,
      trainingMaterialArchived: true,
      evaluationEvidenceArchived: true,
      dossierPrinted: true,
    }, responsible);
    const closed = await service.close(training.id, responsible);
    expect(closed?.closedAt).toBeTruthy();
    expect((await sessions.findById(session.id))?.executionStatus).toBe("EXECUTED");
    const reopened = await service.reopen(training.id, "Correccion posterior", responsible);
    expect(reopened?.closedAt).toBeUndefined();
    expect((await sessions.findById(session.id))?.executionStatus).toBe("EXECUTED");
  });

  it("exige motivo para reabrir", async () => {
    const { training, session, controls, service } = await setup();
    await controls.upsert(session.id, {
      signedAnnexIII: true,
      trainingMaterialArchived: true,
      evaluationEvidenceArchived: true,
      dossierPrinted: true,
    }, responsible);
    await service.close(training.id, responsible);
    await expect(service.reopen(training.id, "", responsible)).rejects.toBeInstanceOf(TrainingClosureNotReadyError);
  });
});
