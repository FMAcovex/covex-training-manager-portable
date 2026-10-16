import { describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/current-user";
import type { Person } from "@/domain/person";
import type { TrainingCatalogs } from "@/domain/training-catalogs";
import type { Training } from "@/domain/training";
import type { TrainingSession } from "@/domain/training-session";
import type { PeopleRepository } from "@/server/people-repository";
import type { SessionRepository } from "@/server/session-repository";
import type { TrainingRepository } from "@/server/training-repository";
import { analyzeTrainingIntegrity, TrainingIntegrityAuthorizationError, TrainingIntegrityService, type TrainingIntegrityDataset } from "./training-integrity-service";

const admin: CurrentUser = { id: "admin", displayName: "Admin ficticio", role: "ADMIN" };
const department = { id: "dep-quality", code: "GC", name: "Garantía de Calidad", active: true };
const trainer: Person = { id: "person-trainer", fullName: "Formador ficticio", employeeCode: "DEMO-T", personType: "INTERNAL", departmentId: department.id, jobTitle: "Formador", active: true };
const attendee: Person = { id: "person-attendee", fullName: "Asistente ficticio", employeeCode: "DEMO-A", personType: "INTERNAL", departmentId: department.id, jobTitle: "Técnico", active: true };
const catalogs: TrainingCatalogs = {
  trainingTypes: [{ id: "type-quality", code: "CAL", name: "Calidad / GMP", active: true }],
  modalities: [{ id: "mod-in-person", code: "PRE", name: "Presencial", active: true }],
  evaluationMethods: [{ id: "eval-test", code: "TEST", name: "Prueba", active: true }],
};

const training = (overrides: Partial<Training> = {}): Training => ({
  id: "training-1",
  code: "FOR-2026-0001",
  year: 2026,
  name: "Formación ficticia completa",
  planningType: "PLANNED",
  trainingTypeId: "type-quality",
  isGmp: true,
  originType: "INTERNAL",
  modalityId: "mod-in-person",
  plannedDurationMinutes: 60,
  materialReference: "PNT-DEMO",
  content: "Contenido ficticio",
  targetGroup: "Personal de calidad",
  targetDepartmentIds: [department.id],
  plannedTrainerPersonIds: [trainer.id],
  plannedTrainerPersonId: trainer.id,
  evaluationMethodId: "eval-test",
  aptitudeCriterion: "Superar la prueba ficticia",
  createdByUserId: admin.id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const session = (overrides: Partial<TrainingSession> = {}): TrainingSession => ({
  id: "session-1",
  trainingId: "training-1",
  code: "FOR-2026-0001-S01",
  plannedDate: "2026-02-01",
  executionDate: "2026-02-01",
  trainerPersonIds: [trainer.id],
  trainerPersonId: trainer.id,
  durationMinutes: 60,
  blankAttendanceRows: 0,
  executionStatus: "EXECUTED",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  executedAt: "2026-02-01T00:00:00.000Z",
  executedByUserId: admin.id,
  attendances: [{
    id: "attendance-1",
    sessionId: "session-1",
    personId: attendee.id,
    attendanceStatus: "ATTENDED",
    result: "PASS",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }],
  ...overrides,
});

const dataset = (overrides: Partial<TrainingIntegrityDataset> = {}): TrainingIntegrityDataset => ({
  trainings: [training()],
  sessions: [session()],
  people: [trainer, attendee],
  departments: [department],
  catalogs,
  ...overrides,
});

const codes = (input: TrainingIntegrityDataset) => analyzeTrainingIntegrity(input).issues.map((issue) => issue.code);

describe("revisión de integridad de formaciones", () => {
  it("clasifica como completa una formación coherente", () => {
    const report = analyzeTrainingIntegrity(dataset());
    expect(report.issues).toHaveLength(0);
    expect(report.summary).toMatchObject({ totalTrainings: 1, reviewedSessions: 1, completeTrainings: 1, warningTrainings: 0, errorTrainings: 0 });
  });

  it("detecta todos los campos mínimos solicitados en una formación interna", () => {
    const incomplete = training({
      trainingTypeId: undefined,
      modalityId: undefined,
      plannedTrainerPersonIds: [],
      plannedTrainerPersonId: undefined,
      targetDepartmentIds: [],
      targetGroup: undefined,
      evaluationMethodId: undefined,
      aptitudeCriterion: undefined,
    });
    const reportCodes = codes(dataset({ trainings: [incomplete] }));
    expect(reportCodes).toEqual(expect.arrayContaining([
      "INTERNAL_EVALUATION_METHOD_MISSING",
      "INTERNAL_APTITUDE_CRITERION_MISSING",
      "TRAINING_TYPE_MISSING",
      "MODALITY_MISSING",
      "PLANNED_TRAINER_MISSING",
      "TARGET_DEPARTMENT_MISSING",
      "TARGET_GROUP_MISSING",
    ]));
  });

  it("detecta sesiones sin formador como error y enlaza su ficha", () => {
    const report = analyzeTrainingIntegrity(dataset({ sessions: [session({ trainerPersonIds: [], trainerPersonId: undefined })] }));
    const issue = report.issues.find((candidate) => candidate.code === "SESSION_TRAINER_MISSING");
    expect(issue).toMatchObject({ severity: "ERROR", href: "/sesiones/session-1", entityType: "SESSION" });
  });

  it("detecta una sesión ejecutada sin fecha de ejecución", () => {
    const report = analyzeTrainingIntegrity(dataset({ sessions: [session({ executionDate: undefined })] }));
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "EXECUTION_DATE_MISSING", severity: "ERROR" }));
  });

  it("contrasta un estado global informado con el derivado de todas las sesiones", () => {
    const pending = session({ executionStatus: "PENDING", executionDate: undefined, executedAt: undefined, executedByUserId: undefined, attendances: [{ ...session().attendances[0], attendanceStatus: "EXPECTED", result: "PENDING" }] });
    const report = analyzeTrainingIntegrity(dataset({ trainings: [training({ globalStatus: "EXECUTED" })], sessions: [pending] }));
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "TRAINING_STATUS_MISMATCH", severity: "ERROR", trainingStatus: "PENDING" }));
  });

  it("diferencia una referencia inactiva histórica de otra todavía pendiente", () => {
    const inactiveTrainer = { ...trainer, active: false };
    const historical = analyzeTrainingIntegrity(dataset({ people: [inactiveTrainer, attendee] }));
    expect(historical.issues).toContainEqual(expect.objectContaining({ code: "INACTIVE_PERSON_REFERENCE", referenceDisposition: "HISTORICAL_VALID" }));

    const pendingSession = session({ executionStatus: "PENDING", executionDate: undefined, executedAt: undefined, executedByUserId: undefined, attendances: [{ ...session().attendances[0], attendanceStatus: "EXPECTED", result: "PENDING" }] });
    const pending = analyzeTrainingIntegrity(dataset({ people: [inactiveTrainer, attendee], sessions: [pendingSession] }));
    expect(pending.issues).toContainEqual(expect.objectContaining({ code: "INACTIVE_PERSON_REFERENCE", referenceDisposition: "REVIEW_REQUIRED" }));
  });

  it("conserva las referencias inactivas como aviso y trata las inexistentes como error", () => {
    const inactiveCatalogs: TrainingCatalogs = { ...catalogs, trainingTypes: [{ ...catalogs.trainingTypes[0], active: false }] };
    const inactiveDepartments = [{ ...department, active: false }];
    const inactive = analyzeTrainingIntegrity(dataset({ catalogs: inactiveCatalogs, departments: inactiveDepartments }));
    expect(inactive.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INACTIVE_CATALOG_REFERENCE", severity: "WARNING", referenceDisposition: "HISTORICAL_VALID" }),
      expect.objectContaining({ code: "INACTIVE_DEPARTMENT_REFERENCE", severity: "WARNING", referenceDisposition: "HISTORICAL_VALID" }),
    ]));

    const missing = analyzeTrainingIntegrity(dataset({ catalogs: { ...catalogs, trainingTypes: [] }, departments: [], people: [attendee] }));
    expect(missing.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_CATALOG_REFERENCE", severity: "ERROR" }),
      expect.objectContaining({ code: "MISSING_DEPARTMENT_REFERENCE", severity: "ERROR" }),
      expect.objectContaining({ code: "MISSING_PERSON_REFERENCE", severity: "ERROR" }),
    ]));
  });

  it("detecta incompatibilidades entre estado, fecha y motivo de no ejecución", () => {
    const notExecuted = session({ executionStatus: "NOT_EXECUTED", executionDate: "2026-02-01", nonExecutionReason: undefined, executedAt: undefined, executedByUserId: undefined, attendances: [{ ...session().attendances[0], attendanceStatus: "EXPECTED", result: "PENDING" }] });
    const reportCodes = codes(dataset({ sessions: [notExecuted] }));
    expect(reportCodes).toEqual(expect.arrayContaining(["SESSION_STATUS_DATA_MISMATCH", "NON_EXECUTION_REASON_MISSING"]));
  });

  it("detecta combinaciones de asistencia incompatibles y asistentes duplicados", () => {
    const invalidAttendance = { ...session().attendances[0], attendanceStatus: "NOT_ATTENDED" as const, result: "PASS" as const };
    const reportCodes = codes(dataset({ sessions: [session({ attendances: [invalidAttendance, { ...invalidAttendance, id: "attendance-2" }] })] }));
    expect(reportCodes).toEqual(expect.arrayContaining(["ATTENDANCE_INCONSISTENCY", "DUPLICATE_REFERENCE"]));
  });

  it("detecta reglas objetivas adicionales de formación", () => {
    const incomplete = training({ planningType: "UNPLANNED", reason: undefined, plannedDurationMinutes: undefined, materialReference: undefined, content: undefined });
    const reportCodes = codes(dataset({ trainings: [incomplete], sessions: [] }));
    expect(reportCodes).toEqual(expect.arrayContaining([
      "UNPLANNED_REASON_MISSING",
      "TRAINING_DURATION_MISSING",
      "MATERIAL_REFERENCE_MISSING",
      "TRAINING_CONTENT_MISSING",
      "TRAINING_WITHOUT_SESSIONS",
    ]));
  });

  it("detecta códigos y relaciones estructurales incoherentes", () => {
    const badTraining = training({ code: "FOR-2025-9999" });
    const badSession = session({ code: "SESION-INCORRECTA" });
    const orphan = session({ id: "orphan-session", trainingId: "missing-training", code: "FOR-2026-9999-S01" });
    const reportCodes = codes(dataset({ trainings: [badTraining], sessions: [badSession, orphan] }));
    expect(reportCodes).toEqual(expect.arrayContaining(["TRAINING_CODE_INCONSISTENCY", "SESSION_CODE_INCONSISTENCY", "SESSION_TRAINING_MISSING"]));
  });

  it("clasifica cada formación una sola vez y prioriza errores sobre avisos", () => {
    const warningOnly = training({ id: "warning", code: "FOR-2026-0002", targetGroup: undefined });
    const warningSession = session({ id: "warning-session", trainingId: "warning", code: "FOR-2026-0002-S01" });
    const errorTraining = training({ id: "error", code: "FOR-2026-0003", targetGroup: undefined });
    const errorSession = session({ id: "error-session", trainingId: "error", code: "FOR-2026-0003-S01", executionDate: undefined });
    const report = analyzeTrainingIntegrity(dataset({ trainings: [training(), warningOnly, errorTraining], sessions: [session(), warningSession, errorSession] }));
    expect(report.summary).toMatchObject({ totalTrainings: 3, completeTrainings: 1, warningTrainings: 1, errorTrainings: 1 });
    expect(report.summary.completeTrainings + report.summary.warningTrainings + report.summary.errorTrainings).toBe(3);
  });

  it("expone años, estados, departamentos y desglose para los filtros", () => {
    const report = analyzeTrainingIntegrity(dataset({ trainings: [training({ targetGroup: undefined })] }));
    expect(report.filters).toMatchObject({ years: [2026], statuses: ["PENDING", "EXECUTED", "NOT_EXECUTED"] });
    expect(report.filters.departments).toContainEqual(expect.objectContaining({ id: department.id }));
    expect(report.breakdown).toContainEqual(expect.objectContaining({ code: "TARGET_GROUP_MISSING", count: 1 }));
  });
});

describe("TrainingIntegrityService", () => {
  const repositories = () => {
    const trainingRepository = {
      list: vi.fn().mockResolvedValue([training()]),
      listCatalogs: vi.fn().mockResolvedValue(catalogs),
    } as unknown as TrainingRepository;
    const sessionRepository = { listAll: vi.fn().mockResolvedValue([session()]) } as unknown as SessionRepository;
    const peopleRepository = {
      list: vi.fn().mockResolvedValue([trainer, attendee]),
      listDepartments: vi.fn().mockResolvedValue([department]),
    } as unknown as PeopleRepository;
    return { trainingRepository, sessionRepository, peopleRepository };
  };

  it("deniega la revisión a roles no administradores antes de leer repositorios", async () => {
    const { trainingRepository, sessionRepository, peopleRepository } = repositories();
    const service = new TrainingIntegrityService(trainingRepository, sessionRepository, peopleRepository);
    await expect(service.review({ id: "user", displayName: "Usuario", role: "RESPONSIBLE" })).rejects.toBeInstanceOf(TrainingIntegrityAuthorizationError);
    expect(trainingRepository.list).not.toHaveBeenCalled();
  });

  it("usa únicamente los repositorios comunes y genera el informe para ADMIN", async () => {
    const { trainingRepository, sessionRepository, peopleRepository } = repositories();
    const service = new TrainingIntegrityService(trainingRepository, sessionRepository, peopleRepository);
    await expect(service.review(admin)).resolves.toMatchObject({ summary: { completeTrainings: 1 } });
    expect(trainingRepository.listCatalogs).toHaveBeenCalledWith({ includeInactive: true });
    expect(peopleRepository.listDepartments).toHaveBeenCalledWith({ includeInactive: true });
  });
});
