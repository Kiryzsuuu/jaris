import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { isValidStatusTransition } from "@/lib/claimTypes";
import { serializeClaim } from "@/lib/claimSerializer";
import { recordAuditLog } from "@/lib/auditLog";
import { notifyClaimStatusChange } from "@/lib/claimNotify";
import Claim from "@/models/Claim";
import Claimant from "@/models/Claimant";

type Params = { params: Promise<{ id: string }> };

// "Kembalikan" - sends a submitted/verified claim back to the reporter for
// revision (draft), distinct from a final rejection. Documents/data stay
// intact so the reporter only fixes what was flagged. Either a verifier or
// an approver can do this from whichever stage they're reviewing at.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_VERIFY);
    const { id } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);

    if (!isValidStatusTransition(claim.status, "draft")) {
      return errorResponse(`Tidak bisa mengembalikan klaim dari status '${claim.status}'`, 409);
    }

    const body = await request.json();
    if (!body.reason) {
      return errorResponse("reason wajib diisi untuk mengembalikan klaim", 400);
    }

    const before = { status: claim.status };
    claim.status = "draft";
    claim.returnedForRevision = {
      returnedBy: new Types.ObjectId(session.sub),
      returnedAt: new Date(),
      reason: body.reason,
    };
    // Clear the previous verification/estimate - it's no longer valid once
    // the reporter can change the underlying data.
    claim.verification = null;
    claim.estimatedAmount = null;
    claim.submittedAt = null;
    await claim.save();

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "claim_returned",
      target: "claim",
      targetId: claim._id,
      before,
      after: { status: claim.status, reason: body.reason },
    });

    await notifyClaimStatusChange({
      reporterId: claim.reporterId,
      claimNumber: claim.claimNumber,
      status: "returned",
      note: body.reason,
    });

    const claimant = await Claimant.findById(claim.claimantId);
    return successResponse(serializeClaim(claim, claimant), "Klaim dikembalikan untuk revisi");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
