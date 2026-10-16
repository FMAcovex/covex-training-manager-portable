import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InMemoryAuditEventRepository } from "@/administration/audit-repository";
import { qualificationIsCurrent, validateTrainerQualification } from "@/domain/trainer";
import { InMemoryPeopleRepository } from "@/server/people-repository";
import { InMemoryTrainerRepository, TrainerConflictError } from "@/server/trainer-repository";

describe("cualificación de formadores", () => {
  it("acepta una fecha de baja vacía como autorización sin baja registrada", () => {
    expect(validateTrainerQualification({
      personId: "demo-1",
      authorizedSubject: "Materia ficticia",
      evidence: "Evidencia ficticia",
      qualifiedFrom: "2026-01-10",
      qualifiedTo: "",
    })).toMatchObject({ qualifiedTo: undefined });
  });

  it("rechaza una baja anterior al alta", () => {
    expect(() => validateTrainerQualification({
      personId: "demo-1",
      authorizedSubject: "Materia ficticia",
      evidence: "Evidencia ficticia",
      qualifiedFrom: "2026-02-10",
      qualifiedTo: "2026-02-09",
    })).toThrow("fecha de baja");
  });

  it("calcula la vigencia por fecha de alta y baja", () => {
    expect(qualificationIsCurrent({ qualifiedFrom: "2026-01-01" }, "2026-10-01")).toBe(true);
    expect(qualificationIsCurrent({ qualifiedFrom: "2026-10-02" }, "2026-10-01")).toBe(false);
    expect(qualificationIsCurrent({ qualifiedFrom: "2026-01-01", qualifiedTo: "2026-09-30" }, "2026-10-01")).toBe(false);
    expect(qualificationIsCurrent({ qualifiedFrom: "2026-01-01", qualifiedTo: "2026-10-01" }, "2026-10-01")).toBe(false);
    expect(qualificationIsCurrent({ qualifiedFrom: "2026-01-01", annulledAt: "2026-09-15T10:00:00.000Z" }, "2026-10-01")).toBe(false);
  });
});

describe("registro de formadores en memoria", () => {
  it("permite varias materias independientes para la misma persona", async () => {
    const people = new InMemoryPeopleRepository();
    const repository = new InMemoryTrainerRepository(people, new InMemoryAuditEventRepository(), false, []);
    const first = await repository.createQualification({
      personId: "demo-1",
      authorizedSubject: "Materia ficticia A",
      evidence: "Evidencia A",
      qualifiedFrom: "2026-01-01",
    }, "demo-user");
    const second = await repository.createQualification({
      personId: "demo-1",
      authorizedSubject: "Materia ficticia B",
      evidence: "Evidencia B",
      qualifiedFrom: "2026-01-01",
    }, "demo-user");
    expect(first.personId).toBe(second.personId);
    expect(await repository.list()).toHaveLength(2);
  });

  it("impide duplicar persona, materia y fecha de alta", async () => {
    const people = new InMemoryPeopleRepository();
    const repository = new InMemoryTrainerRepository(people, new InMemoryAuditEventRepository(), false, []);
    const input = {
      personId: "demo-1",
      authorizedSubject: "Materia ficticia",
      evidence: "Evidencia ficticia",
      qualifiedFrom: "2026-01-01",
    };
    await repository.createQualification(input, "demo-user");
    await expect(repository.createQualification(input, "demo-user")).rejects.toBeInstanceOf(TrainerConflictError);
    await expect(repository.createQualification({ ...input, authorizedSubject: "  MATERIA FICTICIA  " }, "demo-user")).rejects.toBeInstanceOf(TrainerConflictError);
  });

  it("permite dar de baja una cualificación conservando el histórico", async () => {
    const people = new InMemoryPeopleRepository();
    const repository = new InMemoryTrainerRepository(people, new InMemoryAuditEventRepository(), false, []);
    const created = await repository.createQualification({
      personId: "demo-1",
      authorizedSubject: "Materia ficticia",
      evidence: "Evidencia ficticia",
      qualifiedFrom: "2026-01-01",
    }, "demo-user");
    const retired = await repository.retireQualification(created.id, "2026-10-01", "demo-user");
    expect(retired).toMatchObject({ qualifiedTo: "2026-10-01" });
    expect(await repository.list()).toHaveLength(1);
    expect(await repository.list({ currentOnly: true })).toHaveLength(0);
  });

  it("anula un registro erróneo sin borrarlo del histórico", async () => {
    const people = new InMemoryPeopleRepository();
    const repository = new InMemoryTrainerRepository(people, new InMemoryAuditEventRepository(), false, []);
    const created = await repository.createQualification({
      personId: "demo-1",
      authorizedSubject: "Materia ficticia errónea",
      evidence: "Evidencia ficticia",
      qualifiedFrom: "2026-01-01",
    }, "demo-user");
    const annulled = await repository.annulQualification(created.id, "Alta duplicada por error", "demo-user");
    expect(annulled?.annulmentReason).toBe("Alta duplicada por error");
    expect(annulled?.current).toBe(false);
    expect(await repository.list()).toHaveLength(0);
    expect(await repository.list({ includeAnnulled: true })).toEqual([
      expect.objectContaining({ id: created.id, annulmentReason: "Alta duplicada por error" }),
    ]);
  });

  it("impide una baja anterior a la fecha de alta", async () => {
    const people = new InMemoryPeopleRepository();
    const repository = new InMemoryTrainerRepository(people, new InMemoryAuditEventRepository(), false, []);
    const created = await repository.createQualification({
      personId: "demo-1",
      authorizedSubject: "Materia ficticia",
      evidence: "Evidencia ficticia",
      qualifiedFrom: "2026-10-01",
    }, "demo-user");
    await expect(repository.retireQualification(created.id, "2026-09-30", "demo-user")).rejects.toThrow("fecha de baja");
  });

  it("gestiona varios documentos por formador y permite retirarlos", async () => {
    const people = new InMemoryPeopleRepository();
    const repository = new InMemoryTrainerRepository(people, new InMemoryAuditEventRepository(), false, []);
    const first = await repository.addDocument("demo-1", { fileName: "cv-demo.pdf", mimeType: "application/pdf", content: Buffer.from("demo") }, "demo-user");
    const second = await repository.addDocument("demo-1", { fileName: "certificado-demo.pdf", mimeType: "application/pdf", content: Buffer.from("demo-2") }, "demo-user");
    expect(await repository.listDocuments("demo-1")).toHaveLength(2);
    await repository.removeDocument(first.id, "demo-user");
    expect((await repository.listDocuments("demo-1")).map((item) => item.id)).toEqual([second.id]);
  });
});


describe("alta atómica de nuevo formador cualificado", () => {
  it("crea persona y primera cualificación en una sola operación lógica", async () => {
    const people = new InMemoryPeopleRepository([], undefined, false);
    const repository = new InMemoryTrainerRepository(people, new InMemoryAuditEventRepository(), false, []);
    const created = await repository.createQualifiedTrainer({
      fullName: "Formador nuevo ficticio",
      personType: "EXTERNAL",
      company: "Entidad ficticia",
      jobTitle: "Docente",
    }, {
      authorizedSubject: "Materia ficticia",
      evidence: "Evidencia ficticia",
      qualifiedFrom: "2026-10-01",
    }, "demo-user");
    expect((await people.list()).map((person) => person.id)).toContain(created.personId);
    expect(created.person.fullName).toBe("Formador nuevo ficticio");
    expect(await repository.list()).toHaveLength(1);
  });

  it("revierte la Persona si falla la creación de la cualificación", async () => {
    const people = new InMemoryPeopleRepository([], undefined, false);
    const failingAudit = {
      append: async () => { throw new Error("Fallo de auditoría simulado"); },
      list: async () => [],
    };
    const repository = new InMemoryTrainerRepository(people, failingAudit, false, []);
    await expect(repository.createQualifiedTrainer({
      fullName: "Formador huérfano ficticio",
      personType: "EXTERNAL",
      company: "Entidad ficticia",
      jobTitle: "Docente",
    }, {
      authorizedSubject: "Materia ficticia",
      evidence: "Evidencia ficticia",
      qualifiedFrom: "2026-10-01",
    }, "demo-user")).rejects.toThrow("Fallo de auditoría simulado");
    expect(await people.list()).toHaveLength(0);
    expect(await repository.list()).toHaveLength(0);
  });

  it("la implementación Prisma agrupa persona, cualificación y auditoría en una transacción", () => {
    const source = readFileSync("src/server/prisma-trainer-repository.ts", "utf8");
    const method = source.slice(source.indexOf("async createQualifiedTrainer"), source.indexOf("async updateQualification"));
    expect(method).toContain("this.prisma.$transaction");
    expect(method).toContain("transaction.person.create");
    expect(method).toContain("transaction.trainerQualification.create");
    expect(method).toContain("transaction.auditEvent.create");
  });

  it("Prisma usa una clave normalizada para la unicidad de materia", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const migration = readFileSync("prisma/migrations/20261002150000_trainer_subject_normalized_unique/migration.sql", "utf8");
    expect(schema).toContain("authorizedSubjectNormalized String");
    expect(schema).toContain("@@unique([personId, authorizedSubjectNormalized, qualifiedFrom])");
    expect(migration).toContain('lower(btrim("authorizedSubject"))');
  });

  it("Prisma conserva baja y anulación como operaciones auditadas", () => {
    const source = readFileSync("src/server/prisma-trainer-repository.ts", "utf8");
    expect(source).toContain("TRAINER_QUALIFICATION_RETIRED");
    expect(source).toContain("TRAINER_QUALIFICATION_ANNULLED");
    expect(source).toContain("annulledAt");
  });
});
