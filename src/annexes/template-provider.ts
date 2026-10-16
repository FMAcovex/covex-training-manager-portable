import type { AnnexRepository } from "@/annexes/annex-repository";
import type { AnnexType, TemplateVersion } from "@/annexes/types";
import { isSupportedDevelopmentFixture } from "@/annexes/supported-fixtures";

export class TemplateNotFoundError extends Error {}
export class AmbiguousTemplateError extends Error {}
export class TemplateLoadError extends Error {}

export class TemplateProvider {
  constructor(private readonly repository: AnnexRepository) {}

  async resolve(annexType: AnnexType, at = new Date()): Promise<TemplateVersion> {
    const instant = at.valueOf();
    const candidates = (await this.repository.listTemplateVersions(annexType)).filter((template) => {
      const from = new Date(template.effectiveFrom).valueOf();
      const to = template.effectiveTo ? new Date(template.effectiveTo).valueOf() : Number.POSITIVE_INFINITY;
      return template.active && from <= instant && instant <= to;
    });
    const name = annexType === "ANNEX_III" ? "Anexo III" : annexType === "ANNEX_IV" ? "Anexo IV" : "Anexo V";
    if (candidates.length === 0) throw new TemplateNotFoundError(`No existe una plantilla vigente para el ${name}`);
    if (candidates.length > 1) throw new AmbiguousTemplateError(`Existe más de una plantilla vigente para el ${name}`);
    const template = candidates[0];
    if (!isSupportedDevelopmentFixture(template)) {
      throw new TemplateLoadError("La plantilla vigente no puede cargarse con el proveedor configurado");
    }
    return template;
  }
}
