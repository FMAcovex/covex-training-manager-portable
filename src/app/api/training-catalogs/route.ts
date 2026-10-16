import { NextResponse } from "next/server";
import { getApiUser } from "@/auth/api-user";
import { getTrainingRepository } from "@/server/training-repositories";

export async function GET(request: Request) {
  const auth = await getApiUser();
  if ("response" in auth) return auth.response;
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  return NextResponse.json(await getTrainingRepository().listCatalogs({ includeInactive }));
}
