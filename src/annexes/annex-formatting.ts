export function formatSpanishDate(value: string | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) throw new Error("La fecha no tiene un formato válido");
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatDurationHours(minutes: number | undefined): string {
  if (minutes === undefined) return "";
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(".", ",");
}
