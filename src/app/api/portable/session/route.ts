import { NextResponse } from "next/server";
import { readPortablePublicConfiguration } from "@/portable/config";
import {
  createPortableSession,
  getPortableSession,
  PORTABLE_SESSION_COOKIE,
  portableSessionInputSchema,
  removePortableSession,
} from "@/portable/auth/server-session";
import { portableApiError } from "@/portable/api";

export const dynamic = "force-dynamic";

function sameLoopbackOrigin(request: Request) {
  const expected = new URL(readPortablePublicConfiguration().redirectUri).origin;
  return request.headers.get("origin") === expected;
}

export async function POST(request: Request) {
  try {
    if (!sameLoopbackOrigin(request)) return NextResponse.json({ error: "Origen local no permitido" }, { status: 403 });
    const session = await createPortableSession(portableSessionInputSchema.parse(await request.json()));
    const response = NextResponse.json({ displayName: session.displayName, expiresAt: new Date(session.expiresAt).toISOString() });
    response.cookies.set(PORTABLE_SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
      maxAge: Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000)),
    });
    return response;
  } catch (error) {
    return portableApiError(error);
  }
}

export async function GET() {
  const session = await getPortableSession();
  return session
    ? NextResponse.json({ authenticated: true, displayName: session.displayName, expiresAt: new Date(session.expiresAt).toISOString() })
    : NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function DELETE(request: Request) {
  if (!sameLoopbackOrigin(request)) return NextResponse.json({ error: "Origen local no permitido" }, { status: 403 });
  const session = await getPortableSession();
  removePortableSession(session?.id);
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(PORTABLE_SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
