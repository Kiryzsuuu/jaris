import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { isValidStatusTransition, REQUIRED_DOCUMENTS } from "@/lib/claimTypes";
import { serializeClaim } from "@/lib/claimSerializer";
import { recordAuditLog } from "@/lib/auditLog";
import { notifyClaimStatusChange } from "@/lib/claimNotify";
import Claim from "@/models/Claim";
import Claimant from "@/models/Claimant";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_VERIFY);
    const { id } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);

    const body = await request.json();
    const action = body.action;

    if (action === "verify") {
      if (!isValidStatusTransition(claim.status, "verified")) {
        return errorResponse(`Tidak bisa verifikasi dari status '${claim.status}'`, 409);
      }

      const requiredTypes = REQUIRED_DOCUMENTS[claim.caseCategory];
      const uploadedTypes = new Set(claim.documents.map((d) => d.type));
      const missing = requiredTypes.filter((t) => !uploadedTypes.has(t));
      if (missing.length > 0) {
        return errorResponse(
          `Dokumen belum lengkap, kurang: ${missing.join(", ")}`,
          422,
          { missingDocumentTypes: missing }
        );
      }

      const before = { status: claim.status };
      claim.status = "verified";
      claim.verification = {
        verifiedBy: new Types.ObjectId(session.sub),
        verifiedAt: new Date(),
        notes: body.notes,
      };
      await claim.save();

      await recordAuditLog({
        actorId: session.sub,
        actorEmail: session.email,
        action: "claim_verified",
        target: "claim",
        targetId: claim._id,
        before,
        after: { status: claim.status },
      });

      await notifyClaimStatusChange({
        reporterId: claim.reporterId,
        claimNumber: claim.claimNumber,
        status: "verified",
        note: body.notes,
      });
    } else if (action === "reject") {
      if (!isValidStatusTransition(claim.status, "rejected")) {
        return errorResponse(`Tidak bisa menolak dari status '${claim.status}'`, 409);
      }
      if (!body.reason) {
        return errorResponse("reason wajib diisi untuk penolakan", 400);
      }

      const before = { status: claim.status };
      claim.status = "rejected";
      claim.rejection = {
        rejectedBy: new Types.ObjectId(session.sub),
        rejectedAt: new Date(),
        reason: body.reason,
      };
      await claim.save();

      await recordAuditLog({
        actorId: session.sub,
        actorEmail: session.email,
        action: "claim_rejected",
        target: "claim",
        targetId: claim._id,
        before,
        after: { status: claim.status, reason: body.reason },
      });

      await notifyClaimStatusChange({
        reporterId: claim.reporterId,
        claimNumber: claim.claimNumber,
        status: "rejected",
        note: body.reason,
      });
    } else {
      return errorResponse("action harus 'verify' atau 'reject'", 400);
    }

    const claimant = await Claimant.findById(claim.claimantId);
    return successResponse(serializeClaim(claim, claimant), "Status klaim berhasil diperbarui");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
