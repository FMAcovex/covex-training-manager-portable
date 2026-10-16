import { describe, expect, it } from "vitest";
import { demoAnnexIIITemplate, demoAnnexIVTemplate, demoAnnexVTemplate, InMemoryAnnexRepository } from "@/annexes/annex-repository";
import { AmbiguousTemplateError, TemplateLoadError, TemplateNotFoundError, TemplateProvider } from "@/annexes/template-provider";

describe("TemplateProvider", () => {
  it("selecciona la única versión vigente", async () => await expect(new TemplateProvider(new InMemoryAnnexRepository()).resolve("ANNEX_III", new Date("2026-09-20"))).resolves.toMatchObject({ id: demoAnnexIIITemplate.id }));
  it("falla si no existe plantilla vigente", async () => await expect(new TemplateProvider(new InMemoryAnnexRepository([])).resolve("ANNEX_III")).rejects.toBeInstanceOf(TemplateNotFoundError));
  it("falla ante configuración ambigua", async () => { const duplicate = { ...demoAnnexIIITemplate, id: "duplicate", templateVersion: "TEST-2" }; await expect(new TemplateProvider(new InMemoryAnnexRepository([demoAnnexIIITemplate, duplicate])).resolve("ANNEX_III")).rejects.toBeInstanceOf(AmbiguousTemplateError); });
  it("falla si el proveedor de almacenamiento no puede cargarse", async () => { const remote = { ...demoAnnexIIITemplate, storageProvider: "SHAREPOINT", storageReference: "sharepoint://future" }; await expect(new TemplateProvider(new InMemoryAnnexRepository([remote])).resolve("ANNEX_III")).rejects.toBeInstanceOf(TemplateLoadError); });
  it.each([
    ["procedimiento", { ...demoAnnexIIITemplate, procedureCode: "RH-00/003/99" }],
    ["versión", { ...demoAnnexIIITemplate, templateVersion: "TEST-OTRA" }],
  ])("rechaza la fixture si no coincide el %s aunque la referencia sea conocida", async (_field, template) => {
    await expect(new TemplateProvider(new InMemoryAnnexRepository([template])).resolve("ANNEX_III", new Date("2026-05-01"))).rejects.toBeInstanceOf(TemplateLoadError);
  });
  it.each([["ANNEX_IV", demoAnnexIVTemplate], ["ANNEX_V", demoAnnexVTemplate]] as const)("resuelve fixtures sanitizados %s", async (annexType, template) => {
    await expect(new TemplateProvider(new InMemoryAnnexRepository([template])).resolve(annexType, new Date("2026-05-01"))).resolves.toMatchObject({ id: template.id });
  });
  it("menciona dinámicamente el Anexo V cuando falta", async () => await expect(new TemplateProvider(new InMemoryAnnexRepository([])).resolve("ANNEX_V")).rejects.toThrow("Anexo V"));
});
