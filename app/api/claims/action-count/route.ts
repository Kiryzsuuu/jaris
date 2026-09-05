import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { getSession, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import type { ClaimStatus } from "@/lib/claimTypes";
import Claim from "@/models/Claim";

// Lightweight count for the sidebar nav badge - claims sitting in whichever
// stage the current user is able to act on (submitted for a verifier,
// verified for an approver). Counts only, no document payload.
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = getSession(request);

    const statuses: ClaimStatus[] = [];
    if (session.permissions.includes(PERMISSIONS.CLAIM_VERIFY)) statuses.push("submitted");
    if (session.permissions.includes(PERMISSIONS.CLAIM_APPROVE)) statuses.push("verified");

    if (statuses.length === 0) {
      return successResponse({ count: 0 });
    }

    const count = await Claim.countDocuments({ status: { $in: statuses } });
    return successResponse({ count });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
