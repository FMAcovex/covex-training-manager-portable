import { NextResponse } from "next/server";
import { readRuntimeConfiguration } from "@/config/runtime";
import { checkDatabaseConnection } from "@/server/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? "unavailable";
  try {
    const config = readRuntimeConfiguration();
    if (config.persistenceProvider === "server-postgres") await checkDatabaseConnection();

    return NextResponse.json({
      status: "ok",
      environment: config.production ? "production" : "development",
      database: config.persistenceProvider === "server-postgres" ? "ok" : config.persistenceProvider === "demo" ? "demo-memory" : "not-required",
      persistence: config.persistenceProvider,
      authentication: config.authMode,
      sharePoint: config.sharePoint.enabled ? "configured" : "disabled",
      responseTimeMs: Date.now() - startedAt,
      requestId,
    });
  } catch (error) {
    console.error("health_check_failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { status: "error", responseTimeMs: Date.now() - startedAt, requestId },
      { status: 503 },
    );
  }
}
