import type { AttendanceResult } from "@/domain/training-session";
import type { Person } from "@/domain/person";

export type PersonHistoryRow = {
  attendanceId: string;
  trainingName: string;
  executionDate: string;
  trainingType: string;
  materialReference: string;
  result: Extract<AttendanceResult, "PASS" | "FAIL">;
  renewalDate?: string;
  observations: string;
  trainingCode: string;
  sessionCode: string;
};

export type PersonHistory = {
  person: Person;
  department: string;
  year?: number;
  availableYears: number[];
  rows: PersonHistoryRow[];
};
