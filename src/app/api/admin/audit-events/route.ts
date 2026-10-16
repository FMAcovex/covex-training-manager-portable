import { NextResponse } from "next/server";
import { getAuditEventRepository } from "@/administration/repositories";
import { requireAdmin } from "../_utils";
import { parseAuditPagination } from "./pagination";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  const query = new URL(request.url).searchParams;
  return NextResponse.json(
    await getAuditEventRepository().list({
      entityType: query.get("entityType") || undefined,
      action: query.get("action") || undefined,
      actorUserId: query.get("actor") || undefined,
      from: query.get("from") ? `${query.get("from")}T00:00:00.000Z` : undefined,
      to: query.get("to") ? `${query.get("to")}T23:59:59.999Z` : undefined,
      search: query.get("search") || undefined,
      ...parseAuditPagination(query),
    }),
  );
}
