import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

type ErrorConstructor = abstract new (...args: never[]) => Error;

export async function apiErrorResponse(
  error: unknown,
  options: {
    known?: ErrorConstructor[];
    status?: (error: unknown) => number;
    fallback?: string;
  } = {},
) {
  const status = options.status?.(error) ?? (error instanceof ZodError ? 400 : 500);
  const known = error instanceof ZodError || options.known?.some((ErrorType) => error instanceof ErrorType);
  if (known) {
    const message = error instanceof ZodError
      ? error.issues[0]?.message ?? "Datos no válidos"
      : error instanceof Error ? error.message : "Datos no válidos";
    return NextResponse.json({ error: message }, { status });
  }

  const requestId = (await headers()).get("x-request-id") ?? "sin-id";
  console.error(`[${requestId}] Error no controlado en API`, error);
  return NextResponse.json(
    { error: options.fallback ?? "Se ha producido un error interno", requestId },
    { status: 500 },
  );
}
