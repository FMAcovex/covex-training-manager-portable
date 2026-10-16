import type { CurrentUser } from "@/auth/current-user";
import { canCloseTraining } from "@/auth/current-user";
import { isDocumentControlClosureReady } from "@/document-control/domain";
import type { DocumentControlRepository } from "@/document-control/repository";
import type { SessionRepository } from "@/server/session-repository";
import type { TrainingRepository } from "@/server/training-repository";

export class TrainingClosureAuthorizationError extends Error {
  constructor() { super("No autorizado para cerrar o reabrir la formación"); }
}
export class TrainingClosureNotReadyError extends Error {}

export type TrainingClosureState = {
  closed: boolean;
  ready: boolean;
  closedAt?: string;
  closedByUserId?: string;
  blockingReasons: string[];
};

export class TrainingClosureService {
  constructor(
    private readonly trainings: TrainingRepository,
    private readonly sessions: SessionRepository,
    private readonly controls: DocumentControlRepository,
  ) {}

  async evaluate(trainingId: string): Promise<TrainingClosureState | undefined> {
    const training = await this.trainings.findById(trainingId);
    if (!training) return undefined;
    const sessions = await this.sessions.listByTraining(trainingId);
    const blockingReasons: string[] = [];

    if (sessions.length === 0) blockingReasons.push("La formación no tiene sesiones.");
    const notExecuted = sessions.filter((session) => session.executionStatus !== "EXECUTED");
    if (notExecuted.length) blockingReasons.push("Todas las sesiones deben estar ejecutadas antes del cierre documental.");

    const executed = sessions.filter((session) => session.executionStatus === "EXECUTED");
    const controls = new Map((await this.controls.findBySessionIds(executed.map((session) => session.id))).map((control) => [control.sessionId, control]));
    for (const session of executed) {
      const control = controls.get(session.id);
      const stale = Boolean(control && session.executedAt && control.updatedAt < session.executedAt);
      if (!control || stale) {
        blockingReasons.push(`${session.code}: control documental pendiente de revisión.`);
        continue;
      }
      if (!control.dossierPrinted) blockingReasons.push(`${session.code}: impresión pendiente.`);
      if (!isDocumentControlClosureReady(control)) {
        if (!control.signedAnnexIII && !control.signedAnnexIIIReason?.trim()) blockingReasons.push(`${session.code}: falta justificar Anexo III no marcado.`);
        if (!control.trainingMaterialArchived && !control.trainingMaterialReason?.trim()) blockingReasons.push(`${session.code}: falta justificar material no archivado.`);
        if (!control.evaluationEvidenceArchived && !control.evaluationEvidenceReason?.trim()) blockingReasons.push(`${session.code}: falta justificar evaluaciones no archivadas.`);
      }
    }

    return {
      closed: Boolean(training.closedAt),
      ready: blockingReasons.length === 0,
      closedAt: training.closedAt,
      closedByUserId: training.closedByUserId,
      blockingReasons,
    };
  }

  async close(trainingId: string, actor: CurrentUser) {
    if (!canCloseTraining(actor)) throw new TrainingClosureAuthorizationError();
    const state = await this.evaluate(trainingId);
    if (!state) return undefined;
    if (state.closed) throw new TrainingClosureNotReadyError("La formación ya está cerrada.");
    if (!state.ready) throw new TrainingClosureNotReadyError(state.blockingReasons[0] ?? "La formación todavía no cumple los requisitos de cierre.");
    return this.trainings.closeDocumentary(trainingId, actor.id);
  }

  async reopen(trainingId: string, reason: string, actor: CurrentUser) {
    if (!canCloseTraining(actor)) throw new TrainingClosureAuthorizationError();
    if (!reason.trim()) throw new TrainingClosureNotReadyError("El motivo de reapertura es obligatorio.");
    return this.trainings.reopenDocumentary(trainingId, reason.trim(), actor.id);
  }
}
