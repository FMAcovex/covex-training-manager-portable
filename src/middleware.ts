import { NextRequest, NextResponse } from "next/server";
import { desktopRequestRejection } from "@/portable/desktop-policy";

const unsafe = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

function requestIdFrom(request: NextRequest) {
  const incoming = request.headers.get("x-request-id")?.trim();
  return incoming && requestIdPattern.test(incoming) ? incoming : crypto.randomUUID();
}

export function middleware(request: NextRequest) {
  const requestId = requestIdFrom(request);
  const desktopRejection = desktopRequestRejection({ path: request.nextUrl.pathname, method: request.method, host: request.headers.get("host"), origin: request.headers.get("origin"), cookie: request.cookies.get("covex_desktop_instance")?.value }, process.env);
  if (desktopRejection) return NextResponse.json({ error: desktopRejection.error }, { status: desktopRejection.status, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } });
  if (process.env.PERSISTENCE_PROVIDER === "portable-sharepoint" && unsafe.has(request.method) && request.nextUrl.pathname.startsWith("/api/")) {
    const configured = process.env.PORTABLE_ENTRA_REDIRECT_URI;
    const expectedOrigin = configured ? new URL(configured).origin : undefined;
    if (!expectedOrigin || request.headers.get("origin") !== expectedOrigin) {
      return NextResponse.json({ error: "Origen no autorizado para la edición portable." }, { status: 403, headers: { "X-Request-Id": requestId } });
    }
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Request-Id", requestId);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
