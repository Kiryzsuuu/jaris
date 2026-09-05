import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { runFraudDetectionScan } from "@/lib/fraudDetectionAgent";

// Runs the statistical anomaly scan (over-charge z-scores, duplicate
// claimant NIK, shared bank accounts, missing documentation, unusually fast
// approvals) across all non-draft claims. Advisory only - never blocks or
// auto-rejects anything.
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.FRAUD_VIEW);

    const { searchParams } = new URL(request.url);
    const withNarrative = searchParams.get("narrative") !== "false";

    const result = await runFraudDetectionScan(10, { withNarrative });
    return successResponse(result, `${result.findings.length} klaim ditandai dari ${result.scannedCount} yang dipindai`);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
