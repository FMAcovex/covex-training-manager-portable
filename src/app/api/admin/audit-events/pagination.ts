export function parseAuditPagination(query: URLSearchParams) {
  const rawLimit = query.get("limit");
  const rawOffset = query.get("offset");
  const parsedLimit = rawLimit === null ? 100 : Number(rawLimit);
  const parsedOffset = rawOffset === null ? 0 : Number(rawOffset);
  return {
    limit: Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 100,
    offset: Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0,
  };
}
