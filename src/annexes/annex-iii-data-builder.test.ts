import { describe, expect, it } from "vitest";
import { AnnexIIIDataBuilder, AnnexIIIValidationError, type AnnexIIIDataSource } from "@/annexes/annex-iii-data-builder";
import { demoAnnexIIITemplate } from "@/annexes/annex-repository";

const builder = new AnnexIIIDataBuilder();
const source = (): AnnexIIIDataSource => ({
  templateVersion: demoAnnexIIITemplate,
  training: {
    id: "training-test", code: "FOR-2026-0099", year: 2026, name: "Formación ficticia", planningType: "PLANNED", isGmp: false,
    originType: "INTERNAL", trainingTypeId: "type-test", modalityId: "mod-test", materialReference: "MAT-TEST-01", content: "Contenido de prueba",
    targetGroup: "Colectivo ficticio", evaluationMethodId: "eval-test", aptitudeCriterion: "Criterio ficticio", createdByUserId: "user-test",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  },
  session: {
    id: "session-test", trainingId: "training-test", code: "FOR-2026-0099-S01", plannedDate: "2026-09-20", trainerPersonId: "person-trainer",
    durationMinutes: 60, executionStatus: "PENDING", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    attendances: [
      { id: "att-1", sessionId: "session-test", personId: "person-one", attendanceStatus: "EXPECTED", result: "PENDING", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
  },
  people: [
    { id: "person-trainer", fullName: "Formador Ficticio", personType: "INTERNAL", departmentId: "dept-quality", jobTitle: "Formador", active: true },
    { id: "person-one", fullName: "Persona Ficticia Uno", personType: "INTERNAL", departmentId: "dept-quality", jobTitle: "Técnico/a", active: true },
  ],
  departments: [{ id: "dept-quality", code: "CAL", name: "Calidad Ficticia", active: true }],
  catalogs: {
    trainingTypes: [{ id: "type-test", code: "TEST", name: "Tipo ficticio", active: true }],
    modalities: [{ id: "mod-test", code: "PRE", name: "Presencial", active: true }],
    evaluationMethods: [{ id: "eval-test", code: "TEST", name: "Evaluación ficticia", active: true }],
  },
});

describe("AnnexIIIDataBuilder", () => {
  it("usa plannedDate con formato dd/mm/yyyy para una sesión pendiente", () => expect(builder.build(source()).date).toBe("20/09/2026"));
  it("usa executionDate con formato dd/mm/yyyy para una sesión ejecutada", () => { const value = source(); value.session.executionStatus = "EXECUTED"; value.session.executionDate = "2026-09-21"; expect(builder.build(value).date).toBe("21/09/2026"); });
  it("conserva el nombre de un departamento histórico inactivo para una persona inactiva", () => { const value = source(); value.people[1].active = false; value.departments[0].active = false; expect(builder.build(value).attendees[0].department).toBe("Calidad Ficticia"); });
  it("mapea el nombre de la formación", () => expect(builder.build(source()).trainingName).toBe("Formación ficticia"));
  it("resuelve el formador interno desde Person", () => expect(builder.build(source()).trainer).toBe("Formador Ficticio"));
  it("muestra todos los formadores internos", () => { const value = source(); value.people.push({ id: "person-trainer-2", fullName: "Segundo Formador", personType: "INTERNAL", departmentId: "dept-quality", jobTitle: "Formador", active: true }); value.session.trainerPersonIds = ["person-trainer", "person-trainer-2"]; expect(builder.build(value).trainer).toBe("Formador Ficticio, Segundo Formador"); });
  it("permite un formador cualificado externo en una formación interna", () => { const value = source(); value.people[0] = { ...value.people[0], personType: "EXTERNAL", company: "Proveedor Ficticio" }; expect(builder.build(value).trainer).toBe("Formador Ficticio"); });
  it("permite una persona cualificada en una formación externa", () => { const value = source(); value.training.originType = "EXTERNAL"; value.people[0] = { ...value.people[0], personType: "EXTERNAL", company: "Proveedor Ficticio" }; expect(builder.build(value).trainer).toBe("Formador Ficticio"); });
  it("combina personas cualificadas y nombres manuales en una formación externa", () => { const value = source(); value.training.originType = "EXTERNAL"; value.session.externalTrainerNames = ["Entidad Externa Ficticia"]; expect(builder.build(value).trainer).toBe("Formador Ficticio, Entidad Externa Ficticia"); });
  it("evita duplicar el mismo nombre entre selección cualificada y referencia manual", () => { const value = source(); value.training.originType = "EXTERNAL"; value.session.externalTrainerNames = ["formador ficticio"]; expect(builder.build(value).trainer).toBe("Formador Ficticio"); });
  it("incluye los departamentos destinatarios configurados junto al colectivo", () => { const value = source(); value.training.targetDepartmentIds = ["dept-quality"]; expect(builder.build(value).targetGroup).toBe("Colectivo ficticio · Calidad Ficticia"); });
  it("resuelve el formador externo desde la sesión", () => { const value = source(); value.training.originType = "EXTERNAL"; value.session.trainerPersonId = undefined; value.session.externalTrainerName = "Docente Externo Ficticio"; expect(builder.build(value).trainer).toBe("Docente Externo Ficticio"); });
  it("resuelve tipo, modalidad, material y contenido", () => expect(builder.build(source())).toMatchObject({ trainingType: "Tipo ficticio", modality: "Presencial", materialReference: "MAT-TEST-01", content: "Contenido de prueba" }));
  it("incluye el motivo de una no planificada", () => { const value = source(); value.training.planningType = "UNPLANNED"; value.training.reason = "Necesidad ficticia"; expect(builder.build(value).reason).toBe("Necesidad ficticia"); });
  it("deja vacío el motivo de una planificada aunque exista texto", () => { const value = source(); value.training.reason = "No debe imprimirse"; expect(builder.build(value).reason).toBe(""); });
  it("usa el colectivo explícito", () => expect(builder.build(source()).targetGroup).toBe("Colectivo ficticio"));
  it("deriva el colectivo de departamentos únicos", () => { const value = source(); value.training.targetGroup = undefined; expect(builder.build(value).targetGroup).toBe("Calidad Ficticia"); });
  it("mapea departamento y puesto", () => expect(builder.build(source()).attendees[0]).toMatchObject({ department: "Calidad Ficticia", jobTitle: "Técnico/a" }));
  it("añade el número solicitado de filas en blanco sin crear asistentes ficticios", () => {
    const value = source();
    value.session.blankAttendanceRows = 3;
    const data = builder.build(value);
    expect(data.attendees).toHaveLength(4);
    expect(data.attendees.slice(1)).toEqual([
      { number: 2, employeeName: "", department: "", jobTitle: "", signature: "", result: "" },
      { number: 3, employeeName: "", department: "", jobTitle: "", signature: "", result: "" },
      { number: 4, employeeName: "", department: "", jobTitle: "", signature: "", result: "" },
    ]);
  });
  it("permite personal externo sin departamento", () => { const value = source(); value.people[1] = { id: "person-one", fullName: "Persona Externa Ficticia", personType: "EXTERNAL", company: "Empresa Ficticia", jobTitle: "Consultor/a", active: true }; expect(builder.build(value).attendees[0].department).toBe(""); });
  it("mantiene en el documento a una persona histórica inactiva", () => { const value = source(); value.people[1].active = false; expect(builder.build(value).attendees[0].employeeName).toBe("Persona Ficticia Uno"); });
  it("deja resultado y firma vacíos en PENDING", () => expect(builder.build(source()).attendees[0]).toMatchObject({ result: "", signature: "" }));
  it("mapea PASS a APTO y conserva firma vacía", () => { const value = source(); value.session.executionStatus = "EXECUTED"; value.session.executionDate = "2026-09-21"; value.session.attendances[0].attendanceStatus = "ATTENDED"; value.session.attendances[0].result = "PASS"; expect(builder.build(value).attendees[0]).toMatchObject({ result: "APTO", signature: "" }); });
  it("mapea FAIL a NO APTO", () => { const value = source(); value.session.executionStatus = "EXECUTED"; value.session.executionDate = "2026-09-21"; value.session.attendances[0].attendanceStatus = "ATTENDED"; value.session.attendances[0].result = "FAIL"; expect(builder.build(value).attendees[0].result).toBe("NO APTO"); });
  it("no convierte una ausencia en resultado", () => { const value = source(); value.session.executionStatus = "EXECUTED"; value.session.executionDate = "2026-09-21"; value.session.attendances[0].attendanceStatus = "NOT_ATTENDED"; value.session.attendances[0].result = "NOT_APPLICABLE"; expect(builder.build(value).attendees[0].result).toBe(""); });
  it("usa únicamente las notas generales como observaciones", () => { const value = source(); value.session.notes = "Observación general"; value.session.attendances[0].notes = "Nota individual"; expect(builder.build(value).observations).toBe("Observación general"); });
});

describe("validaciones de AnnexIIIDataBuilder", () => {
  const invalid = (change: (value: AnnexIIIDataSource) => void, message: string) => { const value = source(); change(value); expect(() => builder.build(value)).toThrowError(new AnnexIIIValidationError(message)); };
  it("bloquea NOT_EXECUTED", () => invalid((value) => { value.session.executionStatus = "NOT_EXECUTED"; }, "No se puede generar el Anexo III de una sesión no ejecutada"));
  it("bloquea INTERNAL sin método", () => invalid((value) => { value.training.evaluationMethodId = undefined; }, "Falta el método de evaluación de la formación interna"));
  it("bloquea INTERNAL sin criterio", () => invalid((value) => { value.training.aptitudeCriterion = undefined; }, "Falta el criterio de aptitud de la formación interna"));
  it("bloquea UNPLANNED sin motivo", () => invalid((value) => { value.training.planningType = "UNPLANNED"; }, "Falta el motivo de la formación no planificada"));
  it("bloquea una sesión interna sin formador cualificado", () => invalid((value) => { value.session.trainerPersonId = undefined; }, "El formador de la sesión interna no es válido"));
  it("bloquea nombres manuales en una sesión interna", () => invalid((value) => { value.session.externalTrainerName = "Nombre manual"; }, "El formador de la sesión interna no es válido"));
  it("bloquea una sesión externa sin ningún formador", () => invalid((value) => { value.training.originType = "EXTERNAL"; value.session.trainerPersonId = undefined; }, "La sesión externa debe indicar al menos un formador"));
  it("bloquea material obligatorio ausente", () => invalid((value) => { value.training.materialReference = undefined; }, "Falta la versión del material o PNT"));
  it("bloquea tipo obligatorio ausente", () => invalid((value) => { value.training.trainingTypeId = undefined; }, "Falta el tipo de formación o no puede resolverse en el catálogo"));
  it("bloquea modalidad obligatoria ausente", () => invalid((value) => { value.training.modalityId = undefined; }, "Falta la modalidad o no puede resolverse en el catálogo"));
  it("bloquea contenido obligatorio ausente", () => invalid((value) => { value.training.content = undefined; }, "Falta el contenido de la formación"));
  it("bloquea asistentes no resolubles", () => invalid((value) => { value.people = value.people.filter((person) => person.id !== "person-one"); }, "No puede resolverse la persona asistente 1"));
});
