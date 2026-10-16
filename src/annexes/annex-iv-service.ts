import { canGenerateAnnexIV, type CurrentUser } from "@/auth/current-user";
import type { AnnualPlanService } from "@/annual-plan/annual-plan-service";
import type { AnnexRepository } from "@/annexes/annex-repository";
import { AnnexIVDataBuilder } from "@/annexes/annex-iv-data-builder";
import { AnnexIVTemplateAdapter } from "@/annexes/annex-iv-template-adapter";
import { AnnexIVRenderer } from "@/annexes/annex-iv-renderer";
import { AnnexIVDocumentValidator } from "@/annexes/annex-iv-validator";
import { TemplateProvider } from "@/annexes/template-provider";

export class AnnexIVAuthorizationError extends Error { constructor() { super("No autorizado para generar el Anexo IV"); } }

export class AnnexIVService {
  private readonly builder = new AnnexIVDataBuilder();
  private readonly adapter = new AnnexIVTemplateAdapter();
  private readonly renderer = new AnnexIVRenderer();
  private readonly validator = new AnnexIVDocumentValidator();
  private readonly templates: TemplateProvider;
  constructor(private readonly annualPlan: AnnualPlanService, private readonly annexes: AnnexRepository) { this.templates = new TemplateProvider(annexes); }

  async generate(year: number, actor: CurrentUser, at = new Date()) {
    if (!canGenerateAnnexIV(actor)) throw new AnnexIVAuthorizationError();
    if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error("El año no es válido");
    const [plan, templateVersion] = await Promise.all([this.annualPlan.get(year, actor), this.templates.resolve("ANNEX_IV", at)]);
    const data = this.builder.build(plan, templateVersion);
    const renderPlan = this.adapter.createRenderPlan(data);
    const bytes = this.renderer.render(renderPlan);
    const validation = this.validator.validate(bytes, renderPlan);
    const record = await this.annexes.createGeneratedDocument({ annexType: "ANNEX_IV", templateVersionId: templateVersion.id, year, generatedByUserId: actor.id });
    return { bytes, filename: `Anexo_IV_Plan_Formacion_${year}.pdf`, generatedDocumentId: record.id, templateVersionId: templateVersion.id, pageCount: validation.pageCount };
  }
}
