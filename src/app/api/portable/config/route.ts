import { NextResponse } from "next/server";
import { portableApiError } from "@/portable/api";
import { readPortablePublicConfiguration } from "@/portable/config";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(readPortablePublicConfiguration(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return portableApiError(error);
  }
}
