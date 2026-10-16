import type { AnnexType, GeneratedDocument, TemplateVersion } from "@/annexes/types";
import type { CurrentUser } from "@/auth/current-user";
import { InMemoryAuditEventRepository, type AuditEventRepository } from "@/administration/audit-repository";
import { AdminConflictError, overlaps, type TemplateCreateInput, type TemplateUpdateInput } from "@/administration/types";
import { isSupportedDevelopmentFixture, SUPPORTED_DEVELOPMENT_FIXTURES } from "@/annexes/supported-fixtures";

export type GeneratedDocumentInput = Omit<GeneratedDocument, "id" | "generatedAt">;

export function validateGeneratedDocumentInput(input: GeneratedDocumentInput) {
  const valid = input.annexType === "ANNEX_III"
    ? Boolean(input.sessionId) && !input.personId && input.year === undefined
    : input.annexType === "ANNEX_IV"
      ? !input.sessionId && !input.personId && input.year !== undefined
      : !input.sessionId && Boolean(input.personId) && input.year !== undefined;
  if (!valid) throw new Error(`La combinación de referencias no es válida para ${input.annexType}`);
}

export interface AnnexRepository {
  listTemplateVersions(annexType: AnnexType): Promise<TemplateVersion[]>;
  listAllTemplateVersions(): Promise<TemplateVersion[]>;
  registerTemplateVersion(input: TemplateCreateInput, actor: CurrentUser): Promise<TemplateVersion>;
  updateTemplateVersion(id: string, input: TemplateUpdateInput, actor: CurrentUser): Promise<TemplateVersion | undefined>;
  createGeneratedDocument(input: GeneratedDocumentInput): Promise<GeneratedDocument>;
  listGeneratedDocuments(sessionId: string): Promise<GeneratedDocument[]>;
}

const fixedCreatedAt = "2026-04-20T00:00:00.000Z";
export const demoAnnexIIITemplate: TemplateVersion = {
  ...SUPPORTED_DEVELOPMENT_FIXTURES.ANNEX_III,
  id: "template-annex-iii-rh-00-003-05-test-v1",
  effectiveFrom: "2026-04-20T00:00:00.000Z",
  active: true,
  createdAt: fixedCreatedAt,
};

export const demoAnnexIVTemplate: TemplateVersion = {
  ...SUPPORTED_DEVELOPMENT_FIXTURES.ANNEX_IV,
  id: "template-annex-iv-rh-00-003-05-test-v1", effectiveFrom: fixedCreatedAt, active: true, createdAt: fixedCreatedAt,
};

export const demoAnnexVTemplate: TemplateVersion = {
  ...SUPPORTED_DEVELOPMENT_FIXTURES.ANNEX_V,
  id: "template-annex-v-rh-00-003-05-test-v1", effectiveFrom: fixedCreatedAt, active: true, createdAt: fixedCreatedAt,
};

export class InMemoryAnnexRepository implements AnnexRepository {
  private readonly templates: TemplateVersion[];
  private documents: GeneratedDocument[] = [];

  constructor(templates: TemplateVersion[] = [demoAnnexIIITemplate, demoAnnexIVTemplate, demoAnnexVTemplate, { id: "template-future-sharepoint-demo", annexType: "ANNEX_III", procedureCode: "RH-00/003/06", templateVersion: "FUTURA-DEMO", storageProvider: "SHAREPOINT", storageReference: "sharepoint://pendiente-hito-8", effectiveFrom: "2027-01-01T00:00:00.000Z", active: false, createdAt: fixedCreatedAt }], private readonly audit: AuditEventRepository = new InMemoryAuditEventRepository()) {
    this.templates = structuredClone(templates);
  }

  async listTemplateVersions(annexType: AnnexType) {
    return structuredClone(this.templates.filter((template) => template.annexType === annexType));
  }

  async listAllTemplateVersions() { return structuredClone(this.templates.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))); }

  private assertActivation(candidate: TemplateVersion) {
    if (!candidate.active) return;
    if (!isSupportedDevelopmentFixture(candidate)) throw new AdminConflictError("La versión no puede activarse porque su proveedor de almacenamiento todavía no está soportado o su metadata no coincide con la fixture disponible.");
    if (this.templates.some((item) => item.id !== candidate.id && item.annexType === candidate.annexType && item.active && overlaps(item, candidate))) throw new AdminConflictError("Ya existe una versión activa con una vigencia solapada para este anexo");
  }

  async registerTemplateVersion(input: TemplateCreateInput, actor: CurrentUser) {
    if (this.templates.some((item) => item.annexType === input.annexType && item.procedureCode === input.procedureCode && item.templateVersion === input.templateVersion)) throw new AdminConflictError("La versión de plantilla ya existe");
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) throw new AdminConflictError("La fecha de fin no puede ser anterior al inicio");
    const template: TemplateVersion = { ...input, effectiveTo: input.effectiveTo ?? undefined, id: crypto.randomUUID(), createdAt: new Date().toISOString() }; this.assertActivation(template);
    await this.audit.append({ actorUserId: actor.id, entityType: "TEMPLATE_VERSION", entityId: template.id, action: "TEMPLATE_VERSION_REGISTERED", afterJson: template }); this.templates.push(template); return structuredClone(template);
  }

  async updateTemplateVersion(id: string, input: TemplateUpdateInput, actor: CurrentUser) {
    const index = this.templates.findIndex((item) => item.id === id); if (index < 0) return undefined; const before = this.templates[index];
    const after = { ...before, ...input, effectiveTo: input.effectiveTo === null ? undefined : input.effectiveTo ?? before.effectiveTo };
    if (after.effectiveTo && after.effectiveTo < after.effectiveFrom) throw new AdminConflictError("La fecha de fin no puede ser anterior al inicio"); this.assertActivation(after);
    const action = before.active !== after.active ? (after.active ? "TEMPLATE_VERSION_ACTIVATED" : "TEMPLATE_VERSION_DEACTIVATED") : "TEMPLATE_VERSION_UPDATED";
    await this.audit.append({ actorUserId: actor.id, entityType: "TEMPLATE_VERSION", entityId: id, action, beforeJson: before, afterJson: after }); this.templates[index] = after; return structuredClone(after);
  }

  async createGeneratedDocument(input: GeneratedDocumentInput) {
    validateGeneratedDocumentInput(input);
    const document: GeneratedDocument = { ...input, id: crypto.randomUUID(), generatedAt: new Date().toISOString() };
    this.documents.push(document);
    return structuredClone(document);
  }

  async listGeneratedDocuments(sessionId: string) {
    return structuredClone(this.documents.filter((document) => document.sessionId === sessionId));
  }
}
