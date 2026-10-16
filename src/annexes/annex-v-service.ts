import { canGenerateAnnexV, type CurrentUser } from "@/auth/current-user";
import type { PersonHistoryService } from "@/history/person-history-service";
import type { AnnexRepository } from "@/annexes/annex-repository";
import { AnnexVDataBuilder } from "@/annexes/annex-v-data-builder";
import { AnnexVTemplateAdapter } from "@/annexes/annex-v-template-adapter";
import { AnnexVRenderer } from "@/annexes/annex-v-renderer";
import { AnnexVDocumentValidator } from "@/annexes/annex-v-validator";
import { TemplateProvider } from "@/annexes/template-provider";

export class AnnexVAuthorizationError extends Error { constructor() { super("No autorizado para generar el Anexo V"); } }

export class AnnexVService {
  private readonly builder = new AnnexVDataBuilder();
  private readonly adapter = new AnnexVTemplateAdapter();
  private readonly renderer = new AnnexVRenderer();
  private readonly validator = new AnnexVDocumentValidator();
  private readonly templates: TemplateProvider;
  constructor(private readonly history: PersonHistoryService, private readonly annexes: AnnexRepository) { this.templates = new TemplateProvider(annexes); }

  async generate(personId: string, year: number, actor: CurrentUser, at = new Date()) {
    if (!canGenerateAnnexV(actor)) throw new AnnexVAuthorizationError();
    if (!personId.trim()) throw new Error("La persona es obligatoria");
    if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error("El año no es válido");
    const [history, templateVersion] = await Promise.all([this.history.get(personId, actor, year, true), this.templates.resolve("ANNEX_V", at)]);
    const data = this.builder.build(history, templateVersion);
    const renderPlan = this.adapter.createRenderPlan(data);
    const bytes = this.renderer.render(renderPlan);
    const validation = this.validator.validate(bytes, renderPlan);
    const record = await this.annexes.createGeneratedDocument({ annexType: "ANNEX_V", templateVersionId: templateVersion.id, personId, year, generatedByUserId: actor.id });
    return { bytes, filename: `Anexo_V_Resumen_Individual_${year}.pdf`, generatedDocumentId: record.id, templateVersionId: templateVersion.id, pageCount: validation.pageCount };
  }
}
