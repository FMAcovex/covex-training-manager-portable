import { NextResponse } from "next/server";
import { requireAdmin, adminError } from "../_utils";
import { shouldUsePortableSharePoint } from "@/config/runtime";
import { getPortableProvider } from "@/portable/sharepoint/provider";

export const dynamic = "force-dynamic";

/** Read-only diagnostics: releasing a lock requires an IT reconciliation, not an API button. */
export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  if (!shouldUsePortableSharePoint()) return NextResponse.json({ error: "Solo disponible en portable-sharepoint" }, { status: 404 });
  try {
    const rows = await getPortableProvider().store.list<{ state?: string }>("CovexOperation");
    const unresolved = rows.filter((row) => ["HELD", "PREPARING", "RUNNING", "NEEDS_RECONCILIATION"].includes(row.data.state ?? ""));
    const correlations = new Set(unresolved.map((row) => row.correlationId ?? row.id));
    const details = rows.filter((row) => row.data.state === "DETAIL" && correlations.has(row.correlationId ?? ""));
    return NextResponse.json({ operations: [...unresolved, ...details].map((row) => ({ id: row.id, eTag: row.eTag, updatedAt: row.updatedAt, ...row.data })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return adminError(error); }
}
