import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { parseDashboardFilters } from "@/lib/dashboardFilters";
import { getDashboardSummary } from "@/lib/dashboardStats";
import { canViewAllClaims } from "@/lib/claimAccess";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.DASHBOARD_VIEW);

    const filters = parseDashboardFilters(request, session);
    const summary = await getDashboardSummary(filters);

    return successResponse(
      { ...summary, scope: canViewAllClaims(session) ? "all" : "own" },
      "Ringkasan dashboard"
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
