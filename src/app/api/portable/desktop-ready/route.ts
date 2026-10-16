import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public challenge/response proves ownership without sending the secret to an occupied port.
export function GET(request: Request) {
  const mode = process.env.PORTABLE_DESKTOP_MODE;
  const id = process.env.PORTABLE_DESKTOP_INSTANCE_ID;
  const secret = process.env.PORTABLE_DESKTOP_INSTANCE_TOKEN;
  const challenge = request.headers.get("x-covex-challenge") ?? "";
  if (!mode || !id || !secret) return NextResponse.json({ error: "No disponible" }, { status: 404 });
  if (!/^[a-f0-9]{48}$/.test(challenge)) return NextResponse.json({ error: "Desafío no válido" }, { status: 400 });
  const proof = createHmac("sha256", secret).update(`${challenge}:${id}:${process.pid}:${mode}`).digest("hex");
  return NextResponse.json({ id, pid: process.pid, mode, proof }, { headers: { "Cache-Control": "no-store" } });
}
