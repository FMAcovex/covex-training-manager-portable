import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { getAnnualPlanService } from "@/annual-plan/annual-plan-services";
import type { AnnualPlanFilters } from "@/annual-plan/types";

export async function GET(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const query = new URL(request.url).searchParams;
  const year = Number(query.get("year"));
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return NextResponse.json({ error: "El año no es válido" }, { status: 400 });
  const status = query.get("status");
  const originType = query.get("originType");
  const isGmp = query.get("isGmp");
  if (status && !["PENDING", "EXECUTED", "NOT_EXECUTED"].includes(status)) return NextResponse.json({ error: "El estado no es válido" }, { status: 400 });
  if (originType && !["INTERNAL", "EXTERNAL"].includes(originType)) return NextResponse.json({ error: "El origen no es válido" }, { status: 400 });
  if (isGmp && !["true", "false"].includes(isGmp)) return NextResponse.json({ error: "El filtro GMP no es válido" }, { status: 400 });
  const filters: AnnualPlanFilters = {
    search: query.get("search") || undefined,
    status: (status || undefined) as AnnualPlanFilters["status"],
    isGmp: isGmp ? isGmp === "true" : undefined,
    originType: (originType || undefined) as AnnualPlanFilters["originType"],
    trainingTypeId: query.get("trainingTypeId") || undefined,
  };
  try { return NextResponse.json(await getAnnualPlanService().get(year, auth.user, filters)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar el Plan anual" }, { status: 403 }); }
}
