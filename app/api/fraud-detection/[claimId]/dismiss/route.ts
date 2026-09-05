import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { recordAuditLog } from "@/lib/auditLog";
import Claim from "@/models/Claim";

type Params = { params: Promise<{ claimId: string }> };

// Marks a fraud-scan finding as reviewed ("Abaikan" in the UI) so it stops
// surfacing in future scans. Purely a human-review marker - never touches
// the claim's status, amount, or any other field.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.FRAUD_VIEW);
    const { claimId } = await params;

    const claim = await Claim.findById(claimId);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);

    claim.fraudDismissedAt = new Date();
    await claim.save();

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "fraud_finding_dismissed",
      target: "claim",
      targetId: claim._id,
      after: { fraudDismissedAt: claim.fraudDismissedAt },
    });

    return successResponse(null, "Temuan ditandai sudah ditinjau");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
