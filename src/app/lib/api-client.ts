type ApiErrorPayload = { error?: unknown };

export class ApiClientError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await readJson(response);
  if (!response.ok) {
    const apiMessage = (payload as ApiErrorPayload | undefined)?.error;
    throw new ApiClientError(typeof apiMessage === "string" && apiMessage.trim() ? apiMessage : `La solicitud ha fallado (${response.status})`, response.status);
  }
  return payload as T;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
