import type { PlanningType, TrainingOriginType } from "@/domain/training";
import type { SessionExecutionStatus } from "@/domain/training-session";

export type AnnualPlanRow = {
  id: string;
  trainingId: string;
  sessionId?: string;
  trainingCode: string;
  sessionCode?: string;
  course: string;
  year: number;
  planningType: PlanningType;
  trainingTypeId?: string;
  trainingType: string;
  isGmp: boolean;
  originType: TrainingOriginType;
  durationMinutes?: number;
  targetGroup: string;
  plannedDate?: string;
  executionDate?: string;
  trainer: string;
  status: SessionExecutionStatus;
  sessionStatus?: SessionExecutionStatus;
  reason?: string;
  nonExecutionReason?: string;
  attendedCount: number;
  provisional: boolean;
  updatedAt: string;
};

export type AnnualPlanSummary = {
  totalPlanned: number;
  plannedExecuted: number;
  executionPercentage: number | null;
  unplannedExecuted: number;
  pendingPlanned: number;
  allPlannedDelivered: boolean | null;
  lastUpdated?: string;
};

export type AnnualPlan = {
  year: number;
  planned: AnnualPlanRow[];
  unplanned: AnnualPlanRow[];
  summary: AnnualPlanSummary;
};

export type AnnualPlanFilters = {
  search?: string;
  status?: SessionExecutionStatus;
  isGmp?: boolean;
  originType?: TrainingOriginType;
  trainingTypeId?: string;
};
