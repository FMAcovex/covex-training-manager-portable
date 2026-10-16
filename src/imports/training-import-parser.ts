import { createHash } from "node:crypto";
import { readSheet, type CellValue, type Row } from "read-excel-file/node";

export type SourcePerson = {
  sourceId: string;
  fullName: string;
  department: string;
  jobTitle: string;
  active: boolean;
  notes?: string;
};

export type SourceSession = {
  sourceId: string;
  plannedDate: Date | string;
  executionDate?: Date | string;
  trainingName: string;
  trainingType: string;
  unplannedReason?: string;
  targetGroup?: string;
  trainers: string[];
  trainer: string;
  frequencyMonths?: number;
  materialReference?: string;
  modality: string;
  planning: string;
  isGmp: boolean;
  origin: string;
  durationHours: number;
  executionStatus: string;
  notes?: string;
  content?: string;
};

export type SourceAttendance = {
  rowKey: string;
  sessionId: string;
  attendee: string;
  department?: string;
  jobTitle?: string;
  attendanceStatus: string;
  result: string;
  notes?: string;
};

export type ParsedTrainingWorkbook = {
  fingerprint: string;
  people: SourcePerson[];
  sessions: SourceSession[];
  attendances: SourceAttendance[];
  duplicateAttendanceRows: number;
};

const text = (value: CellValue | null | undefined) => String(value ?? "").trim();
const optionalText = (value: CellValue | null | undefined) => text(value) || undefined;
const requiredText = (value: CellValue | null | undefined, label: string, row: number) => {
  const result = text(value);
  if (!result) throw new Error(`${label} está vacío en la fila ${row}`);
  return result;
};
const numberValue = (value: CellValue | null | undefined, label: string, row: number) => {
  const result = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(result) || result <= 0) throw new Error(`${label} no es válido en la fila ${row}`);
  return result;
};
const yes = (value: CellValue | null | undefined) => ["si", "sí", "s"].includes(normalize(text(value)));
export const splitMultiValue = (value: string) => [...new Set(value.split(/\r?\n|;|\||\s+\/\s+/).map((item) => item.trim()).filter(Boolean))];
export const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();

function dataRows(rows: Row[], requiredHeaders: string[], sheetName: string) {
  const headerIndex = rows.findIndex((row) => requiredHeaders.every((header) => row.some((cell) => text(cell) === header)));
  if (headerIndex < 0) throw new Error(`La hoja ${sheetName} no contiene las columnas esperadas`);
  const headers = rows[headerIndex].map(text);
  const indexes = Object.fromEntries(requiredHeaders.map((header) => [header, headers.indexOf(header)]));
  return { indexes, rows: rows.slice(headerIndex + 1), firstRowNumber: headerIndex + 2 };
}

export async function parseTrainingWorkbook(buffer: Buffer): Promise<ParsedTrainingWorkbook> {
  const [peopleSheet, sessionsSheet, attendanceSheet] = await Promise.all([
    readSheet(buffer, "Personal"),
    readSheet(buffer, "Sesiones"),
    readSheet(buffer, "Asistencia"),
  ]);
  const peopleData = dataRows(peopleSheet, ["ID empleado", "Nombre completo", "Departamento", "Puesto", "Activo", "Observaciones"], "Personal");
  const sessionHeaders = ["ID sesión", "Fecha PREVISTA", "Fecha EJECUCIÓN", "Nombre formación", "Tipo", "Motivo si no planificada", "Colectivo objetivo", "Formador", "Frecuencia (meses)", "Versión material/PNT", "PRESENCIAL/ONLINE", "Planificación", "GMP", "Interna/Externa", "Duración (h)", "Estado ejecución", "Observaciones", "Contenido del curso"];
  const sessionData = dataRows(sessionsSheet, sessionHeaders, "Sesiones");
  const attendanceHeaders = ["ID sesión", "Empleado", "Departamento", "Puesto", "Estado asistencia", "Resultado", "Observaciones"];
  const attendanceData = dataRows(attendanceSheet, attendanceHeaders, "Asistencia");

  const people = peopleData.rows.flatMap((row, offset) => {
    if (!text(row[peopleData.indexes["ID empleado"]])) return [];
    const rowNumber = peopleData.firstRowNumber + offset;
    return [{
      sourceId: requiredText(row[peopleData.indexes["ID empleado"]], "ID empleado", rowNumber),
      fullName: requiredText(row[peopleData.indexes["Nombre completo"]], "Nombre completo", rowNumber),
      department: requiredText(row[peopleData.indexes.Departamento], "Departamento", rowNumber),
      jobTitle: requiredText(row[peopleData.indexes.Puesto], "Puesto", rowNumber),
      active: !["no", "inactivo", "false", "0"].includes(normalize(text(row[peopleData.indexes.Activo]))),
      notes: optionalText(row[peopleData.indexes.Observaciones]),
    } satisfies SourcePerson];
  });
  const sessions = sessionData.rows.flatMap((row, offset) => {
    if (!text(row[sessionData.indexes["ID sesión"]])) return [];
    const rowNumber = sessionData.firstRowNumber + offset;
    const plannedDate = row[sessionData.indexes["Fecha PREVISTA"]];
    const executionDate = row[sessionData.indexes["Fecha EJECUCIÓN"]];
    if (!(plannedDate instanceof Date) && !text(plannedDate)) throw new Error(`Fecha PREVISTA está vacía en la fila ${rowNumber}`);
    return [{
      sourceId: requiredText(row[sessionData.indexes["ID sesión"]], "ID sesión", rowNumber),
      plannedDate: plannedDate instanceof Date ? plannedDate : text(plannedDate),
      executionDate: executionDate instanceof Date ? executionDate : optionalText(executionDate),
      trainingName: requiredText(row[sessionData.indexes["Nombre formación"]], "Nombre formación", rowNumber),
      trainingType: requiredText(row[sessionData.indexes.Tipo], "Tipo", rowNumber),
      unplannedReason: optionalText(row[sessionData.indexes["Motivo si no planificada"]]),
      targetGroup: optionalText(row[sessionData.indexes["Colectivo objetivo"]]),
      trainers: splitMultiValue(requiredText(row[sessionData.indexes.Formador], "Formador", rowNumber)),
      trainer: splitMultiValue(requiredText(row[sessionData.indexes.Formador], "Formador", rowNumber))[0],
      frequencyMonths: optionalText(row[sessionData.indexes["Frecuencia (meses)"]]) ? Math.round(numberValue(row[sessionData.indexes["Frecuencia (meses)"]], "Frecuencia", rowNumber)) : undefined,
      materialReference: optionalText(row[sessionData.indexes["Versión material/PNT"]]),
      modality: requiredText(row[sessionData.indexes["PRESENCIAL/ONLINE"]], "Modalidad", rowNumber),
      planning: requiredText(row[sessionData.indexes.Planificación], "Planificación", rowNumber),
      isGmp: yes(row[sessionData.indexes.GMP]),
      origin: requiredText(row[sessionData.indexes["Interna/Externa"]], "Interna/Externa", rowNumber),
      durationHours: numberValue(row[sessionData.indexes["Duración (h)"]], "Duración", rowNumber),
      executionStatus: requiredText(row[sessionData.indexes["Estado ejecución"]], "Estado ejecución", rowNumber),
      notes: optionalText(row[sessionData.indexes.Observaciones]),
      content: optionalText(row[sessionData.indexes["Contenido del curso"]]),
    } satisfies SourceSession];
  });
  const rawAttendances = attendanceData.rows.flatMap((row, offset) => {
    if (!text(row[attendanceData.indexes["ID sesión"]])) return [];
    const rowNumber = attendanceData.firstRowNumber + offset;
    const sessionId = requiredText(row[attendanceData.indexes["ID sesión"]], "ID sesión", rowNumber);
    const attendee = requiredText(row[attendanceData.indexes.Empleado], "Empleado", rowNumber);
    return [{
      rowKey: `${sessionId}:${normalize(attendee)}`,
      sessionId,
      attendee,
      department: optionalText(row[attendanceData.indexes.Departamento]),
      jobTitle: optionalText(row[attendanceData.indexes.Puesto]),
      attendanceStatus: requiredText(row[attendanceData.indexes["Estado asistencia"]], "Estado asistencia", rowNumber),
      result: requiredText(row[attendanceData.indexes.Resultado], "Resultado", rowNumber),
      notes: optionalText(row[attendanceData.indexes.Observaciones]),
    } satisfies SourceAttendance];
  });

  const duplicate = <T>(items: T[], key: (item: T) => string) => items.find((item, index) => items.findIndex((candidate) => key(candidate) === key(item)) !== index);
  const duplicatePerson = duplicate(people, (item) => item.sourceId);
  if (duplicatePerson) throw new Error(`El ID de empleado ${duplicatePerson.sourceId} está duplicado`);
  const duplicateSession = duplicate(sessions, (item) => item.sourceId);
  if (duplicateSession) throw new Error(`El ID de sesión ${duplicateSession.sourceId} está duplicado`);
  const sessionIds = new Set(sessions.map((item) => item.sourceId));
  const attendances: SourceAttendance[] = [];
  for (const item of rawAttendances) {
    const existing = attendances.find((candidate) => candidate.rowKey === item.rowKey);
    if (!existing) { attendances.push(item); continue; }
    const equivalent = existing.sessionId === item.sessionId
      && normalize(existing.attendee) === normalize(item.attendee)
      && existing.department === item.department
      && existing.jobTitle === item.jobTitle
      && existing.attendanceStatus === item.attendanceStatus
      && existing.result === item.result
      && existing.notes === item.notes;
    if (!equivalent) throw new Error(`La asistencia ${item.rowKey} está duplicada con datos distintos`);
  }
  const unknownAttendance = attendances.find((item) => !sessionIds.has(item.sessionId));
  if (unknownAttendance) throw new Error(`La asistencia ${unknownAttendance.rowKey} apunta a una sesión inexistente`);

  return { fingerprint: createHash("sha256").update(buffer).digest("hex"), people, sessions, attendances, duplicateAttendanceRows: rawAttendances.length - attendances.length };
}

export function isoDate(value: Date | string | undefined) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value) return value;
  }
  return undefined;
}
