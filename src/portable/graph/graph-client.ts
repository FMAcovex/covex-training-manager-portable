const GRAPH_ROOT = "https://graph.microsoft.com/v1.0/";
const RETRYABLE_STATUSES = new Set([429, 503, 504]);

export class GraphRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "GraphRequestError";
  }
}

export class GraphConflictError extends GraphRequestError {
  constructor(message = "El elemento cambió en SharePoint. Recarga los datos antes de volver a guardar.") {
    super(message, 412, "preconditionFailed");
    this.name = "GraphConflictError";
  }
}

export type GraphClientOptions = {
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  maxRetries?: number;
};

type GraphCollection<T> = {
  value: T[];
  "@odata.nextLink"?: string;
};

function graphUrl(pathOrUrl: string) {
  const url = new URL(pathOrUrl.replace(/^\//, ""), GRAPH_ROOT);
  if (url.origin !== "https://graph.microsoft.com" || !url.pathname.startsWith("/v1.0/")) {
    throw new GraphRequestError("Microsoft Graph devolvió un enlace de paginación no permitido.", 502, "invalidNextLink");
  }
  return url;
}

function uploadUrl(pathOrUrl: string) {
  const url = new URL(pathOrUrl);
  const host = url.hostname.toLocaleLowerCase();
  const allowed = url.protocol === "https:"
    && (host.endsWith(".up.1drv.com") || host.endsWith(".sharepoint.com"));
  if (!allowed) {
    throw new GraphRequestError("Microsoft Graph devolvió una URL de carga no permitida.", 502, "invalidUploadUrl");
  }
  return url;
}

function retryDelay(response: Response, attempt: number) {
  const millisecondsHeader = response.headers.get("x-ms-retry-after-ms");
  const milliseconds = millisecondsHeader === null ? Number.NaN : Number(millisecondsHeader);
  if (Number.isFinite(milliseconds) && milliseconds >= 0) return Math.min(milliseconds, 30_000);

  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 30_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay) && dateDelay > 0) return Math.min(dateDelay, 30_000);
  }

  return Math.min(250 * 2 ** attempt, 5_000);
}

async function graphError(response: Response) {
  let code: string | undefined;
  let message = `Microsoft Graph respondió con HTTP ${response.status}.`;
  try {
    const body = await response.json() as { error?: { code?: string; message?: string } };
    code = body.error?.code;
    if (body.error?.message) message = body.error.message;
  } catch {
    // Graph can return an empty or non-JSON error body. The status remains useful.
  }
  if (response.status === 412) return new GraphConflictError();
  return new GraphRequestError(message, response.status, code);
}

export class GraphClient {
  private readonly fetcher: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly maxRetries: number;

  constructor(private readonly accessToken: string, options: GraphClientOptions = {}) {
    if (!accessToken.trim()) throw new GraphRequestError("No se recibió un token delegado de Microsoft Graph.", 401);
    this.fetcher = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.maxRetries = options.maxRetries ?? 3;
  }

  async request(pathOrUrl: string, init: RequestInit = {}) {
    const url = graphUrl(pathOrUrl);
    for (let attempt = 0; ; attempt += 1) {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${this.accessToken}`);
      headers.set("Accept", "application/json");
      const response = await this.fetcher(url, { ...init, headers });
      if (response.ok) return response;

      // POST/PATCH/DELETE may already have reached SharePoint. A blind retry can
      // duplicate an item or obscure an acknowledged write; the journal handles uncertainty.
      const repeatable = ["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase());
      if (repeatable && RETRYABLE_STATUSES.has(response.status) && attempt < this.maxRetries) {
        await this.sleep(retryDelay(response, attempt));
        continue;
      }
      throw await graphError(response);
    }
  }

  async requestJson<T>(pathOrUrl: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(pathOrUrl, init);
    return await response.json() as T;
  }

  async paginate<T>(pathOrUrl: string): Promise<T[]> {
    const values: T[] = [];
    let next: string | undefined = pathOrUrl;
    for (let page = 0; next && page < 100; page += 1) {
      const response: GraphCollection<T> = await this.requestJson<GraphCollection<T>>(next);
      if (!Array.isArray(response.value)) {
        throw new GraphRequestError("Microsoft Graph devolvió una colección no válida.", 502, "invalidCollection");
      }
      values.push(...response.value);
      next = response["@odata.nextLink"];
    }
    if (next) throw new GraphRequestError("La consulta superó el límite seguro de 100 páginas.", 502, "pageLimit");
    return values;
  }

  /** Upload-session URLs are pre-authenticated. Never attach the Graph bearer token. */
  async requestUpload(pathOrUrl: string, init: RequestInit = {}) {
    const url = uploadUrl(pathOrUrl);
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.fetcher(url, init);
      if (response.ok) return response;
      if (RETRYABLE_STATUSES.has(response.status) && attempt < this.maxRetries) {
        await this.sleep(retryDelay(response, attempt));
        continue;
      }
      throw await graphError(response);
    }
  }
}
