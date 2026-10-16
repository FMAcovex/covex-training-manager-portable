import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { getPeopleRepository } from "@/server/people-repositories";

export async function GET(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  return NextResponse.json(await getPeopleRepository().listDepartments({ includeInactive }));
}
