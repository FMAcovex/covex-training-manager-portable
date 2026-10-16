import type { AnnexType, TemplateVersion } from "@/annexes/types";

export type SupportedFixtureDefinition = Pick<TemplateVersion, "annexType" | "procedureCode" | "templateVersion" | "storageProvider" | "storageReference">;

export const SUPPORTED_DEVELOPMENT_FIXTURES: Readonly<Record<AnnexType, SupportedFixtureDefinition>> = {
  ANNEX_III: {
    annexType: "ANNEX_III", procedureCode: "RH-00/003/05", templateVersion: "TEST-1", storageProvider: "DEVELOPMENT_FIXTURE",
    storageReference: "fixture://annex-iii/rh-00-003-05-test-v1",
  },
  ANNEX_IV: {
    annexType: "ANNEX_IV", procedureCode: "RH-00/003/05", templateVersion: "TEST-IV-1", storageProvider: "DEVELOPMENT_FIXTURE",
    storageReference: "fixture://annex-iv/rh-00-003-05-test-v1",
  },
  ANNEX_V: {
    annexType: "ANNEX_V", procedureCode: "RH-00/003/05", templateVersion: "TEST-V-1", storageProvider: "DEVELOPMENT_FIXTURE",
    storageReference: "fixture://annex-v/rh-00-003-05-test-v1",
  },
};

export function isSupportedDevelopmentFixture(template: SupportedFixtureDefinition) {
  const supported = SUPPORTED_DEVELOPMENT_FIXTURES[template.annexType];
  return template.procedureCode === supported.procedureCode
    && template.templateVersion === supported.templateVersion
    && template.storageProvider === supported.storageProvider
    && template.storageReference === supported.storageReference;
}
