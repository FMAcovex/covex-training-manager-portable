import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PortableConfigurationError } from "@/portable/config";
import { GraphConflictError, GraphRequestError } from "@/portable/graph/graph-client";

export function delegatedGraphToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer ([A-Za-z0-9._~+/=-]{20,16384})$/);
  if (!match) throw new GraphRequestError("Debes iniciar sesión con Microsoft Entra.", 401, "missingToken");
  return match[1];
}

export function portableApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Los datos no son válidos.", issues: error.issues }, { status: 400 });
  }
  if (error instanceof GraphConflictError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
  }
  if (error instanceof GraphRequestError) {
    const status = [400, 401, 403, 404, 409].includes(error.status) ? error.status : 502;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  if (error instanceof PortableConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof Error && /obligatori|válid|requiere|admite/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("portable_api_error", { errorName: error instanceof Error ? error.name : "UnknownError" });
  return NextResponse.json({ error: "No se pudo completar la operación portable." }, { status: 500 });
}
