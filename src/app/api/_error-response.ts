import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GraphRequestError } from "@/portable/graph/graph-client";
import { PortablePartialWriteError } from "@/portable/sharepoint/unit-of-work";

type ErrorConstructor = abstract new (...args: never[]) => Error;

export async function apiErrorResponse(
  error: unknown,
  options: {
    known?: ErrorConstructor[];
    status?: (error: unknown) => number;
    fallback?: string;
  } = {},
) {
  if (error instanceof PortablePartialWriteError) {
    return NextResponse.json({ error: error.message, code: "reconciliationRequired", correlationId: error.correlationId }, { status: 503 });
  }
  if (error instanceof GraphRequestError) {
    const graphStatus = error.status === 412 ? 409 : [401, 403, 404, 409].includes(error.status) ? error.status : 502;
    return NextResponse.json({ error: error.status === 412 ? error.message : "No se pudo completar la operación con SharePoint. Revisa la conexión y los permisos.", code: error.code }, { status: graphStatus });
  }
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
