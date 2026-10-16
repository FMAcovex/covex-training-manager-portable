import { canReadAnnualPlan } from "@/auth/current-user";
import type { CurrentUser } from "@/auth/current-user";
import type { Person } from "@/domain/person";
import type { Training } from "@/domain/training";
import { calculateTrainingStatus, type TrainingSession, type TrainingGlobalStatus } from "@/domain/training-session";
import type { PeopleRepository } from "@/server/people-repository";
import type { SessionRepository } from "@/server/session-repository";
import type { TrainingRepository } from "@/server/training-repository";
import type { AnnualPlan, AnnualPlanFilters, AnnualPlanRow } from "@/annual-plan/types";

export class AnnualPlanAuthorizationError extends Error { constructor() { super("No autorizado para consultar el Plan anual"); } }

const compareCodes = (a: AnnualPlanRow, b: AnnualPlanRow) => a.trainingCode.localeCompare(b.trainingCode) || (a.sessionCode ?? "").localeCompare(b.sessionCode ?? "");
const comparePlanned = (a: AnnualPlanRow, b: AnnualPlanRow) => {
  if (a.plannedDate && b.plannedDate) return a.plannedDate.localeCompare(b.plannedDate) || compareCodes(a, b);
  if (a.plannedDate) return -1;
  if (b.plannedDate) return 1;
  return compareCodes(a, b);
};
const compareUnplanned = (a: AnnualPlanRow, b: AnnualPlanRow) => (a.executionDate ?? "9999-12-31").localeCompare(b.executionDate ?? "9999-12-31") || compareCodes(a, b);

export class AnnualPlanService {
  constructor(private readonly trainings: TrainingRepository, private readonly sessions: SessionRepository, private readonly people: PeopleRepository) {}

  async getAvailableYears(actor: CurrentUser): Promise<number[]> {
    if (!canReadAnnualPlan(actor)) throw new AnnualPlanAuthorizationError();
    const trainings = await this.trainings.list();
    return [...new Set(trainings.map((training) => training.year))].sort((a, b) => b - a);
  }

  async get(year: number, actor: CurrentUser, filters: AnnualPlanFilters = {}): Promise<AnnualPlan> {
    if (!canReadAnnualPlan(actor)) throw new AnnualPlanAuthorizationError();
    const [trainings, people, departments, catalogs] = await Promise.all([
      this.trainings.list({ year }),
      this.people.list(),
      this.people.listDepartments({ includeInactive: true }),
      this.trainings.listCatalogs({ includeInactive: true }),
    ]);
    const allSessions = await this.sessions.listByTrainingIds(trainings.map((training) => training.id));
    const sessionsByTraining = new Map<string, TrainingSession[]>();
    for (const training of trainings) sessionsByTraining.set(training.id, []);
    for (const session of allSessions) sessionsByTraining.get(session.trainingId)?.push(session);
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const departmentById = new Map(departments.map((department) => [department.id, department.name]));
    const typeById = new Map(catalogs.trainingTypes.map((type) => [type.id, type.name]));
    const statusByTraining = new Map(trainings.map((training) => {
      const sessions = sessionsByTraining.get(training.id) ?? [];
      return [training.id, calculateTrainingStatus(sessions)] as const;
    }));
    const rows = trainings.flatMap((training) => {
      const sessions = sessionsByTraining.get(training.id) ?? [];
      const globalStatus = statusByTraining.get(training.id) ?? "PENDING";
      if (sessions.length === 0) return [this.project(training, undefined, peopleById, departmentById, typeById, globalStatus)];
      return sessions.map((session) => this.project(training, session, peopleById, departmentById, typeById, globalStatus));
    });
    const visible = rows.filter((row) => this.matches(row, filters));
    const planned = visible.filter((row) => row.planningType === "PLANNED").sort(comparePlanned);
    const unplanned = visible.filter((row) => row.planningType === "UNPLANNED").sort(compareUnplanned);
    const plannedTrainings = trainings.filter((training) => training.planningType === "PLANNED");
    const unplannedTrainings = trainings.filter((training) => training.planningType === "UNPLANNED");
    const plannedExecuted = plannedTrainings.filter((training) => statusByTraining.get(training.id) === "EXECUTED").length;
    const unplannedExecuted = unplannedTrainings.filter((training) => statusByTraining.get(training.id) === "EXECUTED").length;
    const pendingPlanned = plannedTrainings.filter((training) => statusByTraining.get(training.id) === "PENDING").length;
    const timestamps = rows.map((row) => row.updatedAt).filter(Boolean).sort();
    return {
      year,
      planned,
      unplanned,
      summary: {
        totalPlanned: plannedTrainings.length,
        plannedExecuted,
        executionPercentage: plannedTrainings.length ? plannedExecuted / plannedTrainings.length * 100 : null,
        unplannedExecuted,
        pendingPlanned,
        allPlannedDelivered: plannedTrainings.length ? plannedExecuted === plannedTrainings.length : null,
        lastUpdated: timestamps.at(-1),
      },
    };
  }

  private project(training: Training, session: TrainingSession | undefined, people: Map<string, Person>, departments: Map<string, string>, types: Map<string, string>, globalStatus: TrainingGlobalStatus): AnnualPlanRow {
    const trainerPersonIds = session
      ? (session.trainerPersonIds?.length ? session.trainerPersonIds : session.trainerPersonId ? [session.trainerPersonId] : [])
      : (training.plannedTrainerPersonIds?.length ? training.plannedTrainerPersonIds : training.plannedTrainerPersonId ? [training.plannedTrainerPersonId] : []);
    const manualTrainerNames = session
      ? (session.externalTrainerNames?.length ? session.externalTrainerNames : session.externalTrainerName ? [session.externalTrainerName] : [])
      : (training.externalTrainerNames?.length ? training.externalTrainerNames : training.externalTrainerName ? [training.externalTrainerName] : []);
    const qualifiedTrainerNames = trainerPersonIds.map((id) => people.get(id)?.fullName ?? "").filter(Boolean);
    const trainerNames = training.originType === "INTERNAL" ? qualifiedTrainerNames : [...qualifiedTrainerNames, ...manualTrainerNames];
    const trainer = [...new Map(trainerNames.filter(Boolean).map((name) => [name.toLocaleLowerCase("es"), name])).values()].join(", ");
    const attendanceDepartments = session ? [...new Set(session.attendances.map((attendance) => people.get(attendance.personId)?.departmentId).filter(Boolean).map((id) => departments.get(id!) ?? "").filter(Boolean))] : [];
    const configuredDepartments = (training.targetDepartmentIds ?? []).map((id) => departments.get(id) ?? "").filter(Boolean);
    const attendedCount = session?.attendances.filter((attendance) => attendance.attendanceStatus === "ATTENDED").length ?? 0;
    const groupParts = [...new Set([training.targetGroup?.trim() ?? "", ...(configuredDepartments.length ? configuredDepartments : attendanceDepartments)].filter(Boolean))];
    const baseGroup = groupParts.join(" · ");
    const targetGroup = session?.executionStatus === "EXECUTED" && baseGroup ? `${baseGroup} (${attendedCount})` : baseGroup;
    const updatedAt = [training.updatedAt, session?.updatedAt].filter(Boolean).sort().at(-1) ?? training.updatedAt;
    return {
      id: `${training.id}:${session?.id ?? "provisional"}`,
      trainingId: training.id,
      sessionId: session?.id,
      trainingCode: training.code,
      sessionCode: session?.code,
      course: training.name,
      year: training.year,
      planningType: training.planningType,
      trainingTypeId: training.trainingTypeId,
      trainingType: types.get(training.trainingTypeId ?? "") ?? "",
      isGmp: training.isGmp,
      originType: training.originType,
      durationMinutes: session?.durationMinutes ?? training.plannedDurationMinutes,
      targetGroup,
      plannedDate: session?.plannedDate,
      executionDate: session?.executionDate,
      trainer,
      status: globalStatus,
      sessionStatus: session?.executionStatus,
      reason: training.reason,
      nonExecutionReason: session?.nonExecutionReason,
      attendedCount,
      provisional: !session,
      updatedAt,
    };
  }

  private matches(row: AnnualPlanRow, filters: AnnualPlanFilters) {
    const search = filters.search?.trim().toLocaleLowerCase("es");
    return (!search || row.course.toLocaleLowerCase("es").includes(search) || row.trainingCode.toLocaleLowerCase("es").includes(search))
      && (!filters.status || row.status === filters.status)
      && (filters.isGmp === undefined || row.isGmp === filters.isGmp)
      && (!filters.originType || row.originType === filters.originType)
      && (!filters.trainingTypeId || row.trainingTypeId === filters.trainingTypeId);
  }
}
