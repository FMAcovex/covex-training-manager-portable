import { describe, expect, it } from "vitest";
import { demoAnnexIIITemplate, demoAnnexIVTemplate, demoAnnexVTemplate, InMemoryAnnexRepository } from "@/annexes/annex-repository";

describe("trazabilidad GeneratedDocument", () => {
  it.each([
    [{ annexType: "ANNEX_III", templateVersionId: demoAnnexIIITemplate.id, sessionId: "s1", generatedByUserId: "u1" }],
    [{ annexType: "ANNEX_IV", templateVersionId: demoAnnexIVTemplate.id, year: 2026, generatedByUserId: "u1" }],
    [{ annexType: "ANNEX_V", templateVersionId: demoAnnexVTemplate.id, personId: "p1", year: 2026, generatedByUserId: "u1" }],
  ] as const)("acepta combinaciones coherentes", async (input) => expect(new InMemoryAnnexRepository().createGeneratedDocument(input)).resolves.toMatchObject(input));
  it.each([
    { annexType: "ANNEX_III", templateVersionId: "t", year: 2026, generatedByUserId: "u" },
    { annexType: "ANNEX_IV", templateVersionId: "t", sessionId: "s", year: 2026, generatedByUserId: "u" },
    { annexType: "ANNEX_V", templateVersionId: "t", personId: "p", generatedByUserId: "u" },
  ] as const)("rechaza combinaciones incoherentes", async (input) => expect(new InMemoryAnnexRepository().createGeneratedDocument(input)).rejects.toThrow("combinación"));
});
