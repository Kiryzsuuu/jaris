import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { canViewAllClaims } from "@/lib/claimAccess";
import Claim from "@/models/Claim";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.DASHBOARD_VIEW);

    if (!canViewAllClaims(session)) {
      return successResponse([], "Cabang (lingkup terbatas)");
    }

    const branches = await Claim.distinct("branch");
    return successResponse((branches as string[]).sort(), "Daftar cabang");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
