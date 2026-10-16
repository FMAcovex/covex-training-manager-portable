import type { CurrentUser } from "@/auth/current-user";
import { canGenerateAnnexIII } from "@/auth/current-user";
import type { PeopleRepository } from "@/server/people-repository";
import type { SessionRepository } from "@/server/session-repository";
import type { TrainingRepository } from "@/server/training-repository";
import type { AnnexRepository } from "@/annexes/annex-repository";
import { AnnexIIIDataBuilder } from "@/annexes/annex-iii-data-builder";
import { AnnexIIIRH0000305TestAdapter } from "@/annexes/annex-iii-template-adapter";
import { DocumentValidator } from "@/annexes/document-validator";
import { PdfDocumentRenderer } from "@/annexes/pdf-document-renderer";
import { TemplateProvider } from "@/annexes/template-provider";

export class AnnexIIIAuthorizationError extends Error { constructor() { super("No autorizado para generar el Anexo III"); } }
export class AnnexIIINotFoundError extends Error {}

export type AnnexIIIGeneration = {
  bytes: Uint8Array;
  filename: string;
  generatedDocumentId: string;
  templateVersionId: string;
  pageCount: number;
};

export class AnnexIIIService {
  private readonly builder = new AnnexIIIDataBuilder();
  private readonly adapter = new AnnexIIIRH0000305TestAdapter();
  private readonly renderer = new PdfDocumentRenderer();
  private readonly validator = new DocumentValidator();
  private readonly templateProvider: TemplateProvider;

  constructor(
    private readonly trainings: TrainingRepository,
    private readonly sessions: SessionRepository,
    private readonly people: PeopleRepository,
    private readonly annexes: AnnexRepository,
  ) {
    this.templateProvider = new TemplateProvider(annexes);
  }

  async generate(sessionId: string, actor: CurrentUser, at = new Date()): Promise<AnnexIIIGeneration> {
    if (!canGenerateAnnexIII(actor)) throw new AnnexIIIAuthorizationError();
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new AnnexIIINotFoundError("Sesión no encontrada");
    const training = await this.trainings.findById(session.trainingId);
    if (!training) throw new AnnexIIINotFoundError("Formación asociada no encontrada");
    const [templateVersion, allPeople, departments, catalogs] = await Promise.all([
      this.templateProvider.resolve("ANNEX_III", at),
      this.people.list(),
      this.people.listDepartments({ includeInactive: true }),
      this.trainings.listCatalogs({ includeInactive: true }),
    ]);
    const data = this.builder.build({ templateVersion, training, session, people: allPeople, departments, catalogs });
    const plan = this.adapter.createRenderPlan(data);
    const bytes = this.renderer.render(plan);
    const validation = this.validator.validatePdf(bytes, plan);
    const record = await this.annexes.createGeneratedDocument({
      annexType: "ANNEX_III",
      templateVersionId: templateVersion.id,
      sessionId: session.id,
      generatedByUserId: actor.id,
    });
    return {
      bytes,
      filename: `Anexo_III_${session.code}.pdf`,
      generatedDocumentId: record.id,
      templateVersionId: templateVersion.id,
      pageCount: validation.pageCount,
    };
  }
}
