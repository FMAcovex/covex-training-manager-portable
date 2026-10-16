import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, apiJson, isAbortError } from "./api-client";

describe("apiJson", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve el JSON de una respuesta correcta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ value: 42 })));
    await expect(apiJson<{ value: number }>("/api/demo")).resolves.toEqual({ value: 42 });
  });

  it("propaga el mensaje de error enviado por la API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Dato no válido" }, { status: 400 })));
    await expect(apiJson("/api/demo")).rejects.toMatchObject<ApiClientError>({ name: "ApiClientError", message: "Dato no válido", status: 400 });
  });

  it("genera un error útil si la respuesta no contiene JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Error", { status: 502, headers: { "content-type": "text/plain" } })));
    await expect(apiJson("/api/demo")).rejects.toMatchObject({ message: "La solicitud ha fallado (502)", status: 502 });
  });
});

describe("isAbortError", () => {
  it("solo identifica cancelaciones de fetch", () => {
    expect(isAbortError(new DOMException("Abortada", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("Fallo"))).toBe(false);
  });
});
