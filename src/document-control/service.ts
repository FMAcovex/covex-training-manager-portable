import type { CurrentUser } from "@/auth/current-user";
import { canReadDocumentControl, canUpdateDocumentControl } from "@/auth/current-user";
import type { SessionRepository } from "@/server/session-repository";
import type { TrainingRepository } from "@/server/training-repository";
import { toDocumentControlState } from "./domain";
import type { DocumentControlRepository } from "./repository";
import type { DocumentControlAttachmentInput, DocumentControlInput, DocumentationFilters, DocumentationRow } from "./types";

export class DocumentControlAuthorizationError extends Error { constructor() { super("No autorizado para gestionar el control documental"); } }
export class DocumentControlNotApplicableError extends Error { constructor() { super("El control documental solo se aplica a sesiones ejecutadas"); } }

export class DocumentControlService {
  constructor(
    private readonly controls: DocumentControlRepository,
    private readonly sessions: SessionRepository,
    private readonly trainings: TrainingRepository,
  ) {}

  async list(actor: CurrentUser, filters: DocumentationFilters = {}): Promise<DocumentationRow[]> {
    if (!canReadDocumentControl(actor)) throw new DocumentControlAuthorizationError();
    const sessions = (await this.sessions.listAll()).filter((session) => session.executionStatus === "EXECUTED" && session.executionDate && (!filters.trainingId || session.trainingId === filters.trainingId));
    const sessionIds = sessions.map((session) => session.id);
    const controls = new Map((await this.controls.findBySessionIds(sessionIds)).map((control) => [control.sessionId, control]));
    const attachments = await this.controls.findAttachmentsBySessionIds(sessionIds);
    const attachmentsBySession = new Map<string, typeof attachments>();
    for (const attachment of attachments) {
      attachmentsBySession.set(attachment.sessionId, [...(attachmentsBySession.get(attachment.sessionId) ?? []), attachment]);
    }
    const trainings = new Map((await this.trainings.list()).map((training) => [training.id, training]));
    const search = filters.search?.trim().toLocaleLowerCase("es");
    return sessions.flatMap((session) => {
      const training = trainings.get(session.trainingId);
      if (!training || !session.executionDate) return [];
      const storedControl = controls.get(session.id);
      const control = storedControl && session.executedAt && storedControl.updatedAt < session.executedAt ? undefined : storedControl;
      const state = toDocumentControlState(control, attachmentsBySession.get(session.id) ?? []);
      if (filters.status && filters.status !== "ALL" && state.documentStatus !== filters.status) return [];
      if (filters.year && Number(session.executionDate.slice(0, 4)) !== filters.year) return [];
      if (search && ![training.name, training.code, session.code].some((value) => value.toLocaleLowerCase("es").includes(search))) return [];
      return [{ ...state, sessionId: session.id, sessionCode: session.code, executionDate: session.executionDate, trainingId: training.id, trainingCode: training.code, trainingName: training.name }];
    }).sort((a, b) => b.executionDate.localeCompare(a.executionDate) || a.sessionCode.localeCompare(b.sessionCode));
  }

  async get(sessionId: string, actor: CurrentUser) {
    if (!canReadDocumentControl(actor)) throw new DocumentControlAuthorizationError();
    const session = await this.sessions.findById(sessionId);
    if (!session) return undefined;
    if (session.executionStatus !== "EXECUTED") throw new DocumentControlNotApplicableError();
    const storedControl = await this.controls.findBySessionId(sessionId);
    const control = storedControl && session.executedAt && storedControl.updatedAt < session.executedAt ? undefined : storedControl;
    return toDocumentControlState(
      control,
      await this.controls.findAttachmentsBySessionId(sessionId),
    );
  }

  async update(sessionId: string, input: DocumentControlInput, actor: CurrentUser) {
    if (!canUpdateDocumentControl(actor)) throw new DocumentControlAuthorizationError();
    const session = await this.sessions.findById(sessionId);
    if (!session) return undefined;
    if (session.executionStatus !== "EXECUTED") throw new DocumentControlNotApplicableError();
    const control = await this.controls.upsert(sessionId, input, actor);
    return toDocumentControlState(control, await this.controls.findAttachmentsBySessionId(sessionId));
  }

  async addAttachment(sessionId: string, input: DocumentControlAttachmentInput, actor: CurrentUser) {
    if (!canUpdateDocumentControl(actor)) throw new DocumentControlAuthorizationError();
    const session = await this.sessions.findById(sessionId);
    if (!session) return undefined;
    if (session.executionStatus !== "EXECUTED") throw new DocumentControlNotApplicableError();
    return this.controls.addAttachment(sessionId, input, actor);
  }

  async getAttachment(sessionId: string, attachmentId: string, actor: CurrentUser) {
    if (!canReadDocumentControl(actor)) throw new DocumentControlAuthorizationError();
    const session = await this.sessions.findById(sessionId);
    if (!session) return undefined;
    if (session.executionStatus !== "EXECUTED") throw new DocumentControlNotApplicableError();
    const attachment = await this.controls.getAttachment(attachmentId);
    return attachment?.sessionId === sessionId ? attachment : undefined;
  }

  async removeAttachment(sessionId: string, attachmentId: string, actor: CurrentUser) {
    if (!canUpdateDocumentControl(actor)) throw new DocumentControlAuthorizationError();
    const session = await this.sessions.findById(sessionId);
    if (!session) return undefined;
    if (session.executionStatus !== "EXECUTED") throw new DocumentControlNotApplicableError();
    const attachment = await this.controls.getAttachment(attachmentId);
    if (!attachment || attachment.sessionId !== sessionId) return undefined;
    return this.controls.removeAttachment(attachmentId, actor);
  }
}
