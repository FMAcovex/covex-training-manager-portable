import { NextResponse, type NextRequest } from "next/server";

const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

function requestIdFrom(request: NextRequest) {
  const incoming = request.headers.get("x-request-id")?.trim();
  return incoming && requestIdPattern.test(incoming) ? incoming : crypto.randomUUID();
}

export function middleware(request: NextRequest) {
  const requestId = requestIdFrom(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Request-Id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
