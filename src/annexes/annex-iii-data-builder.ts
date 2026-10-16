import type { Person } from "@/domain/person";
import type { Department } from "@/domain/department";
import type { TrainingCatalogs } from "@/domain/training-catalogs";
import type { TrainingSession } from "@/domain/training-session";
import type { Training } from "@/domain/training";
import type { AnnexIIIData, AnnexIIIAttendeeRow, TemplateVersion } from "@/annexes/types";

export class AnnexIIIValidationError extends Error {}

export type AnnexIIIDataSource = {
  templateVersion: TemplateVersion;
  training: Training;
  session: TrainingSession;
  people: Person[];
  departments: Department[];
  catalogs: TrainingCatalogs;
};

const requireText = (value: string | undefined, message: string) => {
  const normalized = value?.trim();
  if (!normalized) throw new AnnexIIIValidationError(message);
  return normalized;
};

const formatSpanishDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new AnnexIIIValidationError("La fecha de la sesión no tiene un formato válido");
  return `${match[3]}/${match[2]}/${match[1]}`;
};

export class AnnexIIIDataBuilder {
  build(source: AnnexIIIDataSource): AnnexIIIData {
    const { training, session, templateVersion, catalogs } = source;
    if (session.executionStatus === "NOT_EXECUTED") throw new AnnexIIIValidationError("No se puede generar el Anexo III de una sesión no ejecutada");
    if (session.trainingId !== training.id) throw new AnnexIIIValidationError("La sesión no pertenece a la formación indicada");
    const sourceDate = session.executionStatus === "EXECUTED"
      ? requireText(session.executionDate, "Falta la fecha de ejecución de la sesión")
      : requireText(session.plannedDate, "Falta la fecha prevista de la sesión");
    const date = formatSpanishDate(sourceDate);
    const trainingName = requireText(training.name, "Falta el nombre de la formación");
    const peopleById = new Map(source.people.map((person) => [person.id, person]));
    const trainer = this.resolveTrainer(training, session, peopleById);
    if (training.originType === "INTERNAL") {
      requireText(training.evaluationMethodId, "Falta el método de evaluación de la formación interna");
      requireText(training.aptitudeCriterion, "Falta el criterio de aptitud de la formación interna");
    }
    const materialReference = requireText(training.materialReference, "Falta la versión del material o PNT");
    const trainingType = catalogs.trainingTypes.find((item) => item.id === training.trainingTypeId)?.name;
    const modality = catalogs.modalities.find((item) => item.id === training.modalityId)?.name;
    if (!trainingType) throw new AnnexIIIValidationError("Falta el tipo de formación o no puede resolverse en el catálogo");
    if (!modality) throw new AnnexIIIValidationError("Falta la modalidad o no puede resolverse en el catálogo");
    const content = requireText(training.content, "Falta el contenido de la formación");
    const reason = training.planningType === "UNPLANNED"
      ? requireText(training.reason, "Falta el motivo de la formación no planificada")
      : "";
    const departmentsById = new Map(source.departments.map((department) => [department.id, department.name]));
    const attendees = session.attendances.map((attendance, index): AnnexIIIAttendeeRow => {
      const person = peopleById.get(attendance.personId);
      if (!person) throw new AnnexIIIValidationError(`No puede resolverse la persona asistente ${index + 1}`);
      return {
        number: index + 1,
        employeeName: person.fullName,
        department: person.departmentId ? departmentsById.get(person.departmentId) ?? "" : "",
        jobTitle: person.jobTitle,
        signature: "",
        result: this.resolveResult(session, attendance.attendanceStatus, attendance.result),
      };
    });
    const blankRows = Array.from({ length: session.blankAttendanceRows ?? 0 }, (_, index): AnnexIIIAttendeeRow => ({
      number: attendees.length + index + 1,
      employeeName: "",
      department: "",
      jobTitle: "",
      signature: "",
      result: "",
    }));
    attendees.push(...blankRows);
    const derivedDepartments = [...new Set(attendees.map((attendee) => attendee.department).filter(Boolean))];
    const configuredDepartments = (training.targetDepartmentIds ?? []).map((id) => departmentsById.get(id) ?? "").filter(Boolean);
    const targetParts = [...new Set([training.targetGroup?.trim() ?? "", ...configuredDepartments].filter(Boolean))];
    return {
      templateVersion,
      date,
      trainingName,
      trainer,
      materialReference,
      trainingType,
      modality,
      reason,
      targetGroup: targetParts.join(" · ") || derivedDepartments.join(", "),
      content,
      attendees,
      observations: session.notes?.trim() ?? "",
    };
  }

  private resolveTrainer(training: Training, session: TrainingSession, peopleById: Map<string, Person>) {
    const trainerPersonIds = session.trainerPersonIds?.length ? session.trainerPersonIds : session.trainerPersonId ? [session.trainerPersonId] : [];
    const manualNames = session.externalTrainerNames?.length ? session.externalTrainerNames : session.externalTrainerName ? [session.externalTrainerName] : [];
    const personNames = trainerPersonIds.map((id) => {
      const trainer = peopleById.get(id);
      if (!trainer) throw new AnnexIIIValidationError("No puede resolverse uno de los formadores cualificados de la sesión");
      return requireText(trainer.fullName, "Falta el nombre de un formador cualificado");
    });

    if (training.originType === "INTERNAL") {
      if (personNames.length === 0 || manualNames.length > 0) throw new AnnexIIIValidationError("El formador de la sesión interna no es válido");
      return personNames.join(", ");
    }

    const names = [...personNames, ...manualNames.map((name) => requireText(name, "Falta el nombre de un formador externo"))];
    if (names.length === 0) throw new AnnexIIIValidationError("La sesión externa debe indicar al menos un formador");
    const seen = new Set<string>();
    return names.filter((name) => {
      const key = name.toLocaleLowerCase("es");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).join(", ");
  }

  private resolveResult(session: TrainingSession, attendanceStatus: string, result: string): AnnexIIIAttendeeRow["result"] {
    if (session.executionStatus === "PENDING") return "";
    if (attendanceStatus === "ATTENDED" && result === "PASS") return "APTO";
    if (attendanceStatus === "ATTENDED" && result === "FAIL") return "NO APTO";
    return "";
  }
}
