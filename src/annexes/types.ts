import type { AppRole } from "@/auth/current-user";

export type AnnexType = "ANNEX_III" | "ANNEX_IV" | "ANNEX_V";

export type TemplateVersion = {
  id: string;
  annexType: AnnexType;
  procedureCode: string;
  templateVersion: string;
  storageProvider: string;
  storageReference: string;
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
  createdAt: string;
};

export type GeneratedDocument = {
  id: string;
  annexType: AnnexType;
  templateVersionId: string;
  sessionId?: string;
  personId?: string;
  year?: number;
  generatedByUserId: string;
  generatedAt: string;
};

export type AnnexIIIAttendeeRow = {
  number: number;
  employeeName: string;
  department: string;
  jobTitle: string;
  signature: "";
  result: "" | "APTO" | "NO APTO";
};

export type AnnexIIIData = {
  templateVersion: TemplateVersion;
  date: string;
  trainingName: string;
  trainer: string;
  materialReference: string;
  trainingType: string;
  modality: string;
  reason: string;
  targetGroup: string;
  content: string;
  attendees: AnnexIIIAttendeeRow[];
  observations: string;
};

export type AnnexIIIActor = { id: string; role: AppRole };

export type AnnexIVPlannedRow = {
  course: string;
  gmp: "SI" | "NO";
  origin: "INTERNA" | "EXTERNA";
  durationHours: string;
  targetGroup: string;
  plannedDate: string;
  executionDate: string;
  trainer: string;
  status: "PENDIENTE" | "EJECUTADA" | "NO EJECUTADA";
};

export type AnnexIVUnplannedRow = Omit<AnnexIVPlannedRow, "status"> & { reason: string };

export type AnnexIVData = {
  templateVersion: TemplateVersion;
  year: number;
  initialIssueDate: "";
  planned: AnnexIVPlannedRow[];
  unplannedExecuted: AnnexIVUnplannedRow[];
  summary: {
    totalPlanned: number;
    plannedExecuted: number;
    executionPercentage: string;
    unplannedExecuted: number;
    lastUpdated: string;
    pendingPlanned: number;
    allPlannedDelivered: "SI" | "NO" | "";
    effectiveness: "SI / NO";
  };
  observations: string[];
};

export type AnnexVRow = {
  training: string;
  date: string;
  type: string;
  materialReference: string;
  status: "ASISTE";
  result: "APTO" | "NO APTO";
  renewalDate: string;
  observations: string;
};

export type AnnexVData = {
  templateVersion: TemplateVersion;
  year: number;
  employee: string;
  department: string;
  jobTitle: string;
  totalAttended: number;
  rows: AnnexVRow[];
};
