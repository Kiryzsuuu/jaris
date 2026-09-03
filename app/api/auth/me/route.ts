import { NextRequest } from "next/server";
import { successResponse } from "@/lib/apiResponse";
import { getSession, AuthError, authErrorResponse } from "@/lib/authGuard";

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    return successResponse({
      id: session.sub,
      email: session.email,
      roleId: session.roleId,
      roleSlug: session.roleSlug,
      permissions: session.permissions,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }
}
