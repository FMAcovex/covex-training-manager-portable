import { AnnexType, AttendanceResult, AttendanceStatus, PlanningType, PrismaClient, PersonType, SessionExecutionStatus, TrainingOriginType, UserRole } from "@prisma/client";
import { highestSessionSequence } from "../src/domain/training-session";

if (process.env.APP_ENV?.trim().toLowerCase() === "production" || process.env.WEBSITE_INSTANCE_ID) {
  throw new Error("El seed demo está prohibido en producción");
}

const prisma = new PrismaClient();

async function main() {
  const demoUser = await prisma.userProfile.upsert({ where: { email: "demo@covex.example" }, update: {}, create: { id: "demo-user", entraObjectId: "demo-object-id", email: "demo@covex.example", displayName: "Usuario Demo", role: UserRole.ADMIN } });
  await prisma.userProfile.upsert({ where: { email: "responsable@demo.example" }, update: {}, create: { entraObjectId: "demo-responsible-object", email: "responsable@demo.example", displayName: "Responsable Ficticio", role: UserRole.RESPONSIBLE } });
  await prisma.userProfile.upsert({ where: { email: "usuario@demo.example" }, update: {}, create: { entraObjectId: "demo-user-object", email: "usuario@demo.example", displayName: "Usuario Ficticio", role: UserRole.USER } });
  await prisma.userProfile.upsert({ where: { email: "inactivo@demo.example" }, update: {}, create: { entraObjectId: "demo-inactive-object", email: "inactivo@demo.example", displayName: "Usuario Inactivo Ficticio", role: UserRole.USER, active: false } });
  await prisma.templateVersion.upsert({
    where: { annexType_procedureCode_templateVersion: { annexType: AnnexType.ANNEX_III, procedureCode: "RH-00/003/05", templateVersion: "TEST-1" } },
    update: {},
    create: {
      id: "template-annex-iii-rh-00-003-05-test-v1",
      annexType: AnnexType.ANNEX_III,
      procedureCode: "RH-00/003/05",
      templateVersion: "TEST-1",
      storageProvider: "DEVELOPMENT_FIXTURE",
      storageReference: "fixture://annex-iii/rh-00-003-05-test-v1",
      effectiveFrom: new Date("2026-04-20T00:00:00.000Z"),
    },
  });
  await prisma.templateVersion.upsert({
    where: { annexType_procedureCode_templateVersion: { annexType: AnnexType.ANNEX_III, procedureCode: "RH-00/003/06", templateVersion: "FUTURA-DEMO" } },
    update: {},
    create: { annexType: AnnexType.ANNEX_III, procedureCode: "RH-00/003/06", templateVersion: "FUTURA-DEMO", storageProvider: "SHAREPOINT", storageReference: "sharepoint://pendiente-hito-8", effectiveFrom: new Date("2027-01-01T00:00:00.000Z"), active: false },
  });
  await prisma.templateVersion.upsert({
    where: { annexType_procedureCode_templateVersion: { annexType: AnnexType.ANNEX_IV, procedureCode: "RH-00/003/05", templateVersion: "TEST-IV-1" } },
    update: {},
    create: { id: "template-annex-iv-rh-00-003-05-test-v1", annexType: AnnexType.ANNEX_IV, procedureCode: "RH-00/003/05", templateVersion: "TEST-IV-1", storageProvider: "DEVELOPMENT_FIXTURE", storageReference: "fixture://annex-iv/rh-00-003-05-test-v1", effectiveFrom: new Date("2026-04-20T00:00:00.000Z") },
  });
  await prisma.templateVersion.upsert({
    where: { annexType_procedureCode_templateVersion: { annexType: AnnexType.ANNEX_V, procedureCode: "RH-00/003/05", templateVersion: "TEST-V-1" } },
    update: {},
    create: { id: "template-annex-v-rh-00-003-05-test-v1", annexType: AnnexType.ANNEX_V, procedureCode: "RH-00/003/05", templateVersion: "TEST-V-1", storageProvider: "DEVELOPMENT_FIXTURE", storageReference: "fixture://annex-v/rh-00-003-05-test-v1", effectiveFrom: new Date("2026-04-20T00:00:00.000Z") },
  });
  const departmentCatalog = [
    ["GC", "Garantía de Calidad"],
    ["DT", "Dirección Técnica"],
    ["FQ", "Control de Calidad · Fisicoquímico"],
    ["MICRO", "Control de Calidad · Microbiología"],
    ["EST", "Estabilidad"],
    ["PM-10", "Producción Farma · PM-10"],
    ["PA-20", "Acondicionamiento · PA-20"],
    ["LG-10", "Logística · LG-10"],
    ["LG-20", "Logística · LG-20"],
    ["LG-30", "Logística · LG-30"],
    ["LG-40", "Logística · LG-40"],
    ["COM", "Compras"],
    ["IMEX", "Import-Export"],
    ["MC-10", "Mantenimiento · MC-10"],
    ["MC-20", "Ingeniería / Mantenimiento · MC-20"],
    ["SG-20", "Sistemas Informáticos · SG-20"],
    ["RRHH", "Recursos Humanos"],
    ["MA-00", "Medio Ambiente · MA-00"],
  ] as const;
  const departmentByCode = new Map<string, Awaited<ReturnType<typeof prisma.department.upsert>>>();
  for (const [code, name] of departmentCatalog) {
    const department = await prisma.department.upsert({ where: { code }, update: { name, active: true }, create: { code, name } });
    departmentByCode.set(code, department);
  }
  const quality = departmentByCode.get("GC")!;
  const production = departmentByCode.get("PM-10")!;
  await prisma.department.upsert({ where: { code: "HIS" }, update: {}, create: { code: "HIS", name: "Departamento histórico ficticio", active: false } });
  const internalPerson = await prisma.person.upsert({ where: { employeeCode: "DEMO-001" }, update: {}, create: { employeeCode: "DEMO-001", fullName: "Persona Demo Calidad", personType: PersonType.INTERNAL, departmentId: quality.id, jobTitle: "Técnico/a de calidad" } });
  const externalPerson = await prisma.person.upsert({ where: { employeeCode: "DEMO-002" }, update: {}, create: { employeeCode: "DEMO-002", fullName: "Persona Demo Externa", personType: PersonType.EXTERNAL, company: "Proveedor Demo", departmentId: production.id, jobTitle: "Consultor/a" } });

  const trainingTypeCatalog = [
    ["INI", "Inicial"],
    ["PER", "Periódica / reciclaje"],
    ["RET", "Reentrenamiento"],
    ["EXT", "Extraordinaria"],
    ["CAL", "Calidad / GMP"],
    ["TEC", "Técnica"],
    ["SEG", "Seguridad / PRL"],
    ["ACT", "Actualización / cambio"],
  ] as const;
  for (const [code, name] of trainingTypeCatalog) await prisma.trainingType.upsert({ where: { code }, update: { name, active: true }, create: { code, name } });
  const trainingType = await prisma.trainingType.findUniqueOrThrow({ where: { code: "CAL" } });
  const safetyType = await prisma.trainingType.findUniqueOrThrow({ where: { code: "SEG" } });
  const technicalType = await prisma.trainingType.findUniqueOrThrow({ where: { code: "TEC" } });
  const inPerson = await prisma.modality.upsert({ where: { code: "PRE" }, update: {}, create: { id: "mod-in-person", code: "PRE", name: "Presencial" } });
  const online = await prisma.modality.upsert({ where: { code: "ONL" }, update: {}, create: { id: "mod-online", code: "ONL", name: "Online" } });
  const mixed = await prisma.modality.upsert({ where: { code: "MIX" }, update: {}, create: { id: "mod-mixed", code: "MIX", name: "Mixta" } });
  const testMethod = await prisma.evaluationMethod.upsert({ where: { code: "TEST" }, update: {}, create: { id: "eval-test", code: "TEST", name: "Prueba de conocimientos" } });
  const practicalMethod = await prisma.evaluationMethod.upsert({ where: { code: "PRAC" }, update: {}, create: { id: "eval-practical", code: "PRAC", name: "Evaluación práctica" } });
  await prisma.evaluationMethod.upsert({ where: { code: "OBS" }, update: {}, create: { id: "eval-observation", code: "OBS", name: "Observación" } });
  await prisma.trainingType.upsert({ where: { code: "INA" }, update: {}, create: { code: "INA", name: "Tipo inactivo ficticio", active: false } });

  const firstTraining = await prisma.training.upsert({ where: { code: "FOR-2026-0001" }, update: {}, create: { code: "FOR-2026-0001", year: 2026, name: "Buenas prácticas en zona controlada", planningType: PlanningType.PLANNED, trainingTypeId: trainingType.id, isGmp: true, originType: TrainingOriginType.INTERNAL, modalityId: inPerson.id, plannedDurationMinutes: 120, materialReference: "DOC-DEMO-01", content: "Principios operativos y caso práctico ficticio", targetGroup: "Equipo de demostración", plannedTrainerLinks: { create: [{ personId: internalPerson.id }] }, targetDepartmentLinks: { create: [{ departmentId: quality.id }] }, evaluationMethodId: testMethod.id, aptitudeCriterion: "Resultado mínimo definido antes de la impartición", frequencyMonths: 12, notes: "Dato ficticio", createdByUserId: demoUser.id } });
  const secondTraining = await prisma.training.upsert({ where: { code: "FOR-2026-0002" }, update: {}, create: { code: "FOR-2026-0002", year: 2026, name: "Actualización técnica de equipo simulado", planningType: PlanningType.UNPLANNED, trainingTypeId: technicalType.id, reason: "Actualización de un proceso ficticio", isGmp: false, originType: TrainingOriginType.EXTERNAL, modalityId: online.id, plannedDurationMinutes: 90, plannedExternalTrainerNames: ["Formador externo ficticio"], targetDepartmentLinks: { create: [{ departmentId: production.id }] }, notes: "Dato ficticio", createdByUserId: demoUser.id } });
  const thirdTraining = await prisma.training.upsert({ where: { code: "FOR-2026-0003" }, update: {}, create: { code: "FOR-2026-0003", year: 2026, name: "Seguridad operativa de demostración", planningType: PlanningType.PLANNED, trainingTypeId: safetyType.id, isGmp: false, originType: TrainingOriginType.INTERNAL, modalityId: mixed.id, plannedDurationMinutes: 60, plannedTrainerLinks: { create: [{ personId: internalPerson.id }] }, targetDepartmentLinks: { create: [{ departmentId: production.id }, { departmentId: quality.id }] }, evaluationMethodId: practicalMethod.id, aptitudeCriterion: "Demostración práctica satisfactoria", notes: "Dato ficticio", createdByUserId: demoUser.id } });

  const executed = await prisma.trainingSession.upsert({ where: { code: "FOR-2026-0001-S01" }, update: {}, create: { trainingId: firstTraining.id, code: "FOR-2026-0001-S01", plannedDate: new Date("2026-02-10T00:00:00Z"), executionDate: new Date("2026-02-10T00:00:00Z"), trainerLinks: { create: [{ personId: internalPerson.id }] }, durationMinutes: 120, executionStatus: SessionExecutionStatus.EXECUTED, executedAt: new Date("2026-02-10T12:00:00Z"), executedByUserId: demoUser.id, notes: "Sesión ejecutada ficticia" } });
  const pending = await prisma.trainingSession.upsert({ where: { code: "FOR-2026-0001-S02" }, update: {}, create: { trainingId: firstTraining.id, code: "FOR-2026-0001-S02", plannedDate: new Date("2026-10-20T00:00:00Z"), trainerLinks: { create: [{ personId: internalPerson.id }] }, durationMinutes: 120 } });
  const notExecuted = await prisma.trainingSession.upsert({ where: { code: "FOR-2026-0002-S01" }, update: {}, create: { trainingId: secondTraining.id, code: "FOR-2026-0002-S01", plannedDate: new Date("2026-03-12T00:00:00Z"), externalTrainerNames: ["Formador externo ficticio"], durationMinutes: 90, executionStatus: SessionExecutionStatus.NOT_EXECUTED, nonExecutionReason: "Cambio de agenda ficticio" } });
  const executedWithAbsence = await prisma.trainingSession.upsert({ where: { code: "FOR-2026-0003-S01" }, update: {}, create: { trainingId: thirdTraining.id, code: "FOR-2026-0003-S01", plannedDate: new Date("2026-05-05T00:00:00Z"), executionDate: new Date("2026-05-05T00:00:00Z"), trainerLinks: { create: [{ personId: internalPerson.id }] }, durationMinutes: 60, executionStatus: SessionExecutionStatus.EXECUTED, executedAt: new Date("2026-05-05T12:00:00Z"), executedByUserId: demoUser.id } });
  const executedComplete = await prisma.trainingSession.upsert({ where: { code: "FOR-2026-0003-S02" }, update: {}, create: { trainingId: thirdTraining.id, code: "FOR-2026-0003-S02", plannedDate: new Date("2026-06-05T00:00:00Z"), executionDate: new Date("2026-06-05T00:00:00Z"), trainerLinks: { create: [{ personId: internalPerson.id }] }, durationMinutes: 60, executionStatus: SessionExecutionStatus.EXECUTED, executedAt: new Date("2026-06-05T12:00:00Z"), executedByUserId: demoUser.id, notes: "Sesión ficticia con documentación completa" } });

  await prisma.documentControl.upsert({ where: { sessionId: executedWithAbsence.id }, update: {}, create: { sessionId: executedWithAbsence.id, signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: false, updatedByUserId: demoUser.id } });
  await prisma.documentControl.upsert({ where: { sessionId: executedComplete.id }, update: {}, create: { sessionId: executedComplete.id, signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: true, updatedByUserId: demoUser.id } });

  const attendanceRows = [
    { sessionId: executed.id, personId: internalPerson.id, attendanceStatus: AttendanceStatus.ATTENDED, result: AttendanceResult.PASS, notes: null },
    { sessionId: executed.id, personId: externalPerson.id, attendanceStatus: AttendanceStatus.ATTENDED, result: AttendanceResult.FAIL, notes: "Requiere refuerzo ficticio" },
    { sessionId: pending.id, personId: internalPerson.id, attendanceStatus: AttendanceStatus.EXPECTED, result: AttendanceResult.PENDING, notes: null },
    { sessionId: pending.id, personId: externalPerson.id, attendanceStatus: AttendanceStatus.EXPECTED, result: AttendanceResult.PENDING, notes: null },
    { sessionId: notExecuted.id, personId: externalPerson.id, attendanceStatus: AttendanceStatus.EXPECTED, result: AttendanceResult.PENDING, notes: null },
    { sessionId: executedWithAbsence.id, personId: internalPerson.id, attendanceStatus: AttendanceStatus.ATTENDED, result: AttendanceResult.PASS, notes: null },
    { sessionId: executedWithAbsence.id, personId: externalPerson.id, attendanceStatus: AttendanceStatus.NOT_ATTENDED, result: AttendanceResult.NOT_APPLICABLE, notes: "Ausencia ficticia" },
    { sessionId: executedComplete.id, personId: internalPerson.id, attendanceStatus: AttendanceStatus.ATTENDED, result: AttendanceResult.PASS, notes: null },
  ];
  for (const row of attendanceRows) await prisma.attendance.upsert({ where: { sessionId_personId: { sessionId: row.sessionId, personId: row.personId } }, update: row, create: row });
  for (const training of [firstTraining, secondTraining, thirdTraining]) {
    const sessionCodes = await prisma.trainingSession.findMany({ where: { trainingId: training.id }, select: { code: true } });
    const lastIssuedSessionSequence = highestSessionSequence(training.code, sessionCodes.map((session) => session.code));
    await prisma.$executeRaw`
      INSERT INTO "SessionCodeSequence" ("trainingId", "lastValue", "updatedAt")
      VALUES (${training.id}, ${lastIssuedSessionSequence}, CURRENT_TIMESTAMP)
      ON CONFLICT ("trainingId") DO UPDATE
      SET "lastValue" = GREATEST("SessionCodeSequence"."lastValue", EXCLUDED."lastValue"),
          "updatedAt" = CURRENT_TIMESTAMP
    `;
  }

  const trainingCodes = await prisma.training.findMany({ where: { year: 2026 }, select: { code: true } });
  const lastIssuedSequence = trainingCodes.reduce((maximum, training) => {
    const match = /^FOR-2026-(\d{4})$/.exec(training.code);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  await prisma.$executeRaw`
    INSERT INTO "TrainingCodeSequence" ("year", "lastValue", "updatedAt")
    VALUES (2026, ${lastIssuedSequence}, CURRENT_TIMESTAMP)
    ON CONFLICT ("year") DO UPDATE
    SET "lastValue" = GREATEST("TrainingCodeSequence"."lastValue", EXCLUDED."lastValue"),
        "updatedAt" = CURRENT_TIMESTAMP
  `;
}

main().finally(() => prisma.$disconnect());
