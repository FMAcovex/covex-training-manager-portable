export function formatDateEs(value?: string | null) {
  if (!value) return "—";
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isoDate ? value + "T00:00:00.000Z" : value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: isoDate ? "UTC" : undefined,
  }).format(date);
}

export function formatDateTimeEs(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
