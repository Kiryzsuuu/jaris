import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { isValidStatusTransition } from "@/lib/claimTypes";
import { calculateCompensation, TariffEngineError } from "@/lib/tariffEngine";
import { serializeClaim } from "@/lib/claimSerializer";
import { recordAuditLog } from "@/lib/auditLog";
import Claim from "@/models/Claim";
import Claimant from "@/models/Claimant";
import TariffRule from "@/models/TariffRule";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_CREATE);
    const { id } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);
    if (claim.reporterId.toString() !== session.sub) {
      return errorResponse("Akses ditolak: bukan klaim milik Anda", 403);
    }
    if (!isValidStatusTransition(claim.status, "submitted")) {
      return errorResponse(`Tidak bisa submit dari status '${claim.status}'`, 409);
    }

    const tariffRule = await TariffRule.findOne({
      category: claim.caseCategory,
      transportMode: claim.transportMode,
      isActive: true,
    }).sort({ effectiveDate: -1 });

    if (!tariffRule) {
      return errorResponse(
        `Tarif untuk kategori '${claim.caseCategory}' / moda '${claim.transportMode}' belum tersedia. Hubungi admin.`,
        422
      );
    }

    let estimate;
    try {
      estimate = calculateCompensation(
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
    claim.status = "submitted";
    claim.estimatedAmount = estimate.amount;
    claim.submittedAt = new Date();
    await claim.save();

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "claim_submitted",
      target: "claim",
      targetId: claim._id,
      before,
      after: { status: claim.status, estimatedAmount: claim.estimatedAmount, formula: estimate.formula },
    });

    const claimant = await Claimant.findById(claim.claimantId);
    return successResponse(serializeClaim(claim, claimant), "Klaim berhasil diajukan (submitted)");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
