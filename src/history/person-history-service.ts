import { canReadPersonHistory } from "@/auth/current-user";
import type { CurrentUser } from "@/auth/current-user";
import type { PeopleRepository } from "@/server/people-repository";
import type { SessionRepository } from "@/server/session-repository";
import type { TrainingRepository } from "@/server/training-repository";
import type { PersonHistory, PersonHistoryRow } from "@/history/types";

export class PersonHistoryAuthorizationError extends Error { constructor() { super("No autorizado para consultar el historial formativo"); } }
export class PersonHistoryNotFoundError extends Error { constructor() { super("Persona no encontrada"); } }

export function addCalendarMonths(dateText: string, months: number): string {
  const [year, month, day] = dateText.split("-").map(Number);
  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export class PersonHistoryService {
  constructor(private readonly trainings: TrainingRepository, private readonly sessions: SessionRepository, private readonly people: PeopleRepository) {}

  async get(personId: string, actor: CurrentUser, year?: number, ascending = false): Promise<PersonHistory> {
    if (!canReadPersonHistory(actor)) throw new PersonHistoryAuthorizationError();
    const person = await this.people.findById(personId);
    if (!person) throw new PersonHistoryNotFoundError();
    const [sessions, departments, catalogs] = await Promise.all([
      this.sessions.listByPerson(personId),
      this.people.listDepartments({ includeInactive: true }),
      this.trainings.listCatalogs({ includeInactive: true }),
    ]);
    const received = sessions.flatMap((session) => {
      if (!session.executionDate) return [];
      const attendance = session.attendances.find((item) => item.personId === personId);
      if (!attendance || attendance.attendanceStatus !== "ATTENDED" || (attendance.result !== "PASS" && attendance.result !== "FAIL")) return [];
      return [{ session: { ...session, executionDate: session.executionDate }, attendance: { ...attendance, result: attendance.result } }];
    });
    const trainingIds = [...new Set(received.map(({ session }) => session.trainingId))];
    const trainings = new Map((await this.trainings.findByIds(trainingIds)).map((training) => [training.id, training]));
    const typeNames = new Map(catalogs.trainingTypes.map((type) => [type.id, type.name]));
    const rows = received.flatMap(({ session, attendance }): PersonHistoryRow[] => {
      if (year !== undefined && Number(session.executionDate.slice(0, 4)) !== year) return [];
      const training = trainings.get(session.trainingId);
      if (!training) return [];
      return [{
        attendanceId: attendance.id,
        trainingName: training.name,
        executionDate: session.executionDate,
        trainingType: typeNames.get(training.trainingTypeId ?? "") ?? "",
        materialReference: training.materialReference ?? "",
        result: attendance.result,
        renewalDate: attendance.result === "PASS" && training.frequencyMonths ? addCalendarMonths(session.executionDate, training.frequencyMonths) : undefined,
        observations: attendance.notes ?? "",
        trainingCode: training.code,
        sessionCode: session.code,
      }];
    });
    const direction = ascending ? 1 : -1;
    rows.sort((a, b) => direction * a.executionDate.localeCompare(b.executionDate) || a.trainingCode.localeCompare(b.trainingCode) || a.sessionCode.localeCompare(b.sessionCode));
    const availableYears = [...new Set(received.map(({ session }) => Number(session.executionDate.slice(0, 4))))].sort((a, b) => b - a);
    return { person, department: departments.find((department) => department.id === person.departmentId)?.name ?? "", year, availableYears, rows };
  }
}
