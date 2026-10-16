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

export async function GET(request: Request) {
  try {
    return NextResponse.json({ items: await repository(request).list() });
  } catch (error) {
    return portableApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = portableTrainingInputSchema.parse(await request.json());
    return NextResponse.json(await repository(request).create(input), { status: 201 });
  } catch (error) {
    return portableApiError(error);
  }
}
