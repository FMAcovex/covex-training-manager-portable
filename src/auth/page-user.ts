import { redirect } from "next/navigation";
import { AuthenticationError, getCurrentUser } from "@/auth/request-user";

export async function getPageUser() {
  try {
    return await getCurrentUser();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/acceso-denegado");
    throw error;
  }
}
