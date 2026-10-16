import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/auth/current-user";
import { AuthenticationError } from "@/auth/request-user";

export type ApiUserResult =
  | { user: CurrentUser; response?: never }
  | { user?: never; response: NextResponse };

export async function getApiUser(): Promise<ApiUserResult> {
  try {
    return { user: await getCurrentUser() };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return {
        response: NextResponse.json(
          { error: error.message },
          { status: error.status },
        ),
      };
    }
    throw error;
  }
}
