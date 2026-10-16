import type { SessionExecutionStatus } from "@/domain/training-session";

export const INTEGRITY_ISSUE_LABELS = {
  INTERNAL_EVALUATION_METHOD_MISSING: "Formación interna sin método de evaluación",
  INTERNAL_APTITUDE_CRITERION_MISSING: "Formación interna sin criterio de aptitud",
  TRAINING_TYPE_MISSING: "Formación sin tipo",
  MODALITY_MISSING: "Formación sin modalidad",
  PLANNED_TRAINER_MISSING: "Formación sin formador previsto",
  TARGET_DEPARTMENT_MISSING: "Formación sin departamentos destinatarios",
  TARGET_GROUP_MISSING: "Formación sin colectivo objetivo",
  SESSION_TRAINER_MISSING: "Sesión sin formador",
  EXECUTION_DATE_MISSING: "Sesión ejecutada sin fecha de ejecución",
  TRAINING_STATUS_MISMATCH: "Estado global de formación incoherente",
  INACTIVE_CATALOG_REFERENCE: "Referencia a catálogo inactivo",
  INACTIVE_DEPARTMENT_REFERENCE: "Referencia a departamento inactivo",
  INACTIVE_PERSON_REFERENCE: "Referencia a persona inactiva",
  MISSING_CATALOG_REFERENCE: "Referencia a catálogo inexistente",
  MISSING_DEPARTMENT_REFERENCE: "Referencia a departamento inexistente",
  MISSING_PERSON_REFERENCE: "Referencia a persona inexistente",
  UNPLANNED_REASON_MISSING: "Formación no planificada sin motivo",
  TRAINING_DURATION_MISSING: "Formación sin duración prevista",
  MATERIAL_REFERENCE_MISSING: "Formación sin material o referencia",
  TRAINING_CONTENT_MISSING: "Formación sin contenido",
  TRAINING_WITHOUT_SESSIONS: "Formación sin sesiones",
  TRAINER_ORIGIN_MISMATCH: "Formador incompatible con el origen",
  SESSION_STATUS_DATA_MISMATCH: "Estado y datos de sesión incoherentes",
  NON_EXECUTION_REASON_MISSING: "Sesión no ejecutada sin motivo",
  ATTENDANCE_INCONSISTENCY: "Asistencia o resultado incoherente",
  DUPLICATE_REFERENCE: "Referencia duplicada",
  TRAINING_CODE_INCONSISTENCY: "Código de formación incoherente",
  SESSION_CODE_INCONSISTENCY: "Código de sesión incoherente",
  SESSION_PLANNED_DATE_INVALID: "Fecha prevista de sesión no válida",
  SESSION_DURATION_INVALID: "Duración de sesión no válida",
  SESSION_TRAINING_MISSING: "Sesión sin formación existente",
  PERSON_PROFILE_INCOMPLETE: "Datos esenciales de persona incompletos",
  EXECUTION_TRACE_MISSING: "Trazabilidad de ejecución incompleta",
} as const;

export type IntegrityIssueCode = keyof typeof INTEGRITY_ISSUE_LABELS;
export type IntegritySeverity = "ERROR" | "WARNING";
export type IntegrityClassification = "COMPLETE" | IntegritySeverity;
export type ReferenceDisposition = "HISTORICAL_VALID" | "REVIEW_REQUIRED";

export type IntegrityIssue = {
  id: string;
  code: IntegrityIssueCode;
  title: string;
  severity: IntegritySeverity;
  message: string;
  entityType: "TRAINING" | "SESSION";
  trainingId?: string;
  trainingCode?: string;
  trainingName?: string;
  sessionId?: string;
  sessionCode?: string;
  year?: number;
  trainingStatus?: SessionExecutionStatus;
  departmentIds: string[];
  href: string;
  referenceDisposition?: ReferenceDisposition;
};

export type TrainingIntegrityRecord = {
  trainingId: string;
  trainingCode: string;
  trainingName: string;
  year: number;
  status: SessionExecutionStatus;
  departmentIds: string[];
  classification: IntegrityClassification;
  issueCount: number;
};

export type IntegrityIssueBreakdown = {
  code: IntegrityIssueCode;
  label: string;
  count: number;
  errorCount: number;
  warningCount: number;
};

export type TrainingIntegrityReport = {
  summary: {
    totalTrainings: number;
    reviewedSessions: number;
    completeTrainings: number;
    warningTrainings: number;
    errorTrainings: number;
    totalIssues: number;
    errorIssues: number;
    warningIssues: number;
  };
  trainings: TrainingIntegrityRecord[];
  issues: IntegrityIssue[];
  breakdown: IntegrityIssueBreakdown[];
  filters: {
    years: number[];
    departments: Array<{ id: string; name: string; active: boolean }>;
    statuses: SessionExecutionStatus[];
  };
};
