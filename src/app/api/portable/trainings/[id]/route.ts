import { NextResponse } from "next/server";
import { delegatedGraphToken, portableApiError } from "@/portable/api";
import { readPortableServerConfiguration } from "@/portable/config";
import { GraphClient } from "@/portable/graph/graph-client";
import { portableTrainingInputSchema, SharePointTrainingRepository } from "@/portable/sharepoint/training-repository";

export const dynamic = "force-dynamic";

function repository(request: Request) {
  const config = readPortableServerConfiguration();
  return new SharePointTrainingRepository(
    new GraphClient(delegatedGraphToken(request)),
    config.siteId,
    config.trainingsListId,
  );
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await repository(request).findById((await context.params).id));
  } catch (error) {
    return portableApiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const eTag = request.headers.get("if-match") ?? "";
    const input = portableTrainingInputSchema.parse(await request.json());
    return NextResponse.json(await repository(request).update((await context.params).id, input, eTag));
  } catch (error) {
    return portableApiError(error);
  }
}
