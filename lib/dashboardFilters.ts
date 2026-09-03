import type { NextRequest } from "next/server";
import type { AccessTokenPayload } from "@/lib/auth";
import { canViewAllClaims } from "@/lib/claimAccess";
import type { DashboardFilters } from "@/lib/dashboardStats";

/**
 * Builds aggregation filters from query params, enforcing RBAC scope:
 * Petugas Lapangan (no claim:verify/claim:approve) only ever see their own
 * claims - the branch filter is ignored for them and reporterId is forced.
 */
export function parseDashboardFilters(
  request: NextRequest,
  session: AccessTokenPayload
): DashboardFilters {
  const { searchParams } = new URL(request.url);
  const branch = searchParams.get("branch") || undefined;
  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");

  const filters: DashboardFilters = {};

  if (dateFromParam) {
    const d = new Date(dateFromParam);
    if (!isNaN(d.getTime())) filters.dateFrom = d;
  }
  if (dateToParam) {
    const d = new Date(dateToParam);
    if (!isNaN(d.getTime())) filters.dateTo = d;
  }

  if (canViewAllClaims(session)) {
    if (branch) filters.branch = branch;
  } else {
    filters.reporterId = session.sub;
  }

  return filters;
}
