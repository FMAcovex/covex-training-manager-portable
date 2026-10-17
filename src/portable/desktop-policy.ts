type DesktopRequest = { path: string; method: string; host: string | null; origin: string | null; cookie?: string };
type Rejection = { status: number; error: string };
const ORIGIN = "http://127.0.0.1:43110";
const unsafe = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Exact method + path allowlist. Never authorize a whole resource prefix: its
// descendants include attachments, document controls and privileged operations.
const id = "[A-Za-z0-9_-]+";
const demoWrites: Record<string, RegExp[]> = {
  POST: [
    /^\/api\/people$/,
    /^\/api\/trainings$/,
    new RegExp(`^/api/trainings/${id}/sessions$`),
    new RegExp(`^/api/sessions/${id}/(finalize|reopen|annex-iii)$`),
    /^\/api\/annual-plan\/\d{4}\/annex-iv$/,
    new RegExp(`^/api/people/${id}/annex-v$`),
  ],
  PATCH: [new RegExp(`^/api/trainings/${id}$`), new RegExp(`^/api/sessions/${id}$`)],
};

export function desktopRequestRejection(request: DesktopRequest, env: Record<string, string | undefined>): Rejection | undefined {
  const mode = env.PORTABLE_DESKTOP_MODE;
  if (!mode) return undefined;
  if (!["demo", "corporate"].includes(mode) || !/^[a-f0-9]{64}$/.test(env.PORTABLE_DESKTOP_INSTANCE_TOKEN ?? "") || !/^[a-f0-9]{48}$/.test(env.PORTABLE_DESKTOP_INSTANCE_ID ?? "")) return { status: 503, error: "El lanzador portable no ha establecido una sesión local válida." };
  if (request.host !== "127.0.0.1:43110") return { status: 403, error: "Host local no permitido." };
  if (request.path === "/api/portable/desktop-ready" && request.method === "GET") return undefined;
  if (request.cookie !== env.PORTABLE_DESKTOP_INSTANCE_TOKEN) return { status: 401, error: "Abre COVEX desde su ejecutable portable. La sesión local no es válida." };
  if (unsafe.has(request.method) && request.origin !== ORIGIN) return { status: 403, error: "Origen no autorizado para la aplicación portable." };
  if (mode === "demo") {
    if (env.APP_ENV !== "development" || env.AUTH_MODE !== "demo" || env.PERSISTENCE_PROVIDER !== "demo" || env.DATABASE_URL) return { status: 503, error: "La demostración no puede utilizar una configuración corporativa." };
    if (request.path.startsWith("/api/portable/")) return { status: 403, error: "DEMO — DATOS FICTICIOS: Microsoft 365 y sincronización no están disponibles." };
    if (!["GET", "HEAD"].includes(request.method) && !demoWrites[request.method]?.some((pattern) => pattern.test(request.path))) return { status: 403, error: "DEMO — DATOS FICTICIOS: operación no autorizada. Solo formaciones, sesiones, asistentes y anexos sintéticos; sin importaciones ni adjuntos. No introduzcas datos reales." };
  } else if (env.APP_ENV !== "production" || env.AUTH_MODE !== "portable-entra" || env.PERSISTENCE_PROVIDER !== "portable-sharepoint") return { status: 503, error: "El piloto corporativo no puede utilizar autenticación o persistencia demo." };
  return undefined;
}
