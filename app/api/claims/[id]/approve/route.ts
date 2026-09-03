import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { isValidStatusTransition } from "@/lib/claimTypes";
import { calculateCompensation, TariffEngineError } from "@/lib/tariffEngine";
import { serializeClaim } from "@/lib/claimSerializer";
import { recordAuditLog } from "@/lib/auditLog";
import { notifyClaimStatusChange } from "@/lib/claimNotify";
import Claim from "@/models/Claim";
import Claimant from "@/models/Claimant";
import TariffRule from "@/models/TariffRule";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_APPROVE);
    const { id } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);

    const body = await request.json();
    const action = body.action;

    if (action === "approve") {
      if (!isValidStatusTransition(claim.status, "approved")) {
        return errorResponse(`Tidak bisa approve dari status '${claim.status}'`, 409);
      }

      // Recalculate deterministically at approval time - never trust a stale
      // client-supplied amount, and never let approvedAmount be entered free-form.
      const tariffRule = await TariffRule.findOne({
        category: claim.caseCategory,
        transportMode: claim.transportMode,
        isActive: true,
      }).sort({ effectiveDate: -1 });

      if (!tariffRule) {
        return errorResponse(
          `Tarif untuk kategori '${claim.caseCategory}' / moda '${claim.transportMode}' tidak tersedia`,
          422
        );
      }

      let result;
      try {
        result = calculateCompensation(
          {
            category: tariffRule.category,
            transportMode: tariffRule.transportMode,
            maxAmount: tariffRule.maxAmount,
          },
          {
            category: claim.caseCategory,
            transportMode: claim.transportMode,
            disabilityPercentage: claim.disabilityPercentage,
            claimedTreatmentCost: claim.claimedTreatmentCost,
          }
        );
      } catch (error) {
        if (error instanceof TariffEngineError) {
          return errorResponse(error.message, 400);
        }
        throw error;
      }

      const before = { status: claim.status };
      claim.status = "approved";
      claim.estimatedAmount = result.amount;
      claim.approvedAmount = result.amount;
      claim.approval = {
        approvedBy: new Types.ObjectId(session.sub),
        approvedAt: new Date(),
        notes: body.notes,
      };
      await claim.save();

      await recordAuditLog({
        actorId: session.sub,
        actorEmail: session.email,
        action: "claim_approved",
        target: "claim",
        targetId: claim._id,
        before,
        after: { status: claim.status, approvedAmount: claim.approvedAmount, formula: result.formula },
      });

      await notifyClaimStatusChange({
        reporterId: claim.reporterId,
        claimNumber: claim.claimNumber,
        status: "approved",
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
      return errorResponse("action harus 'approve' atau 'reject'", 400);
    }

    const claimant = await Claimant.findById(claim.claimantId);
    return successResponse(serializeClaim(claim, claimant), "Status klaim berhasil diperbarui");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
