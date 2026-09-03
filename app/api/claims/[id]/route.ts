import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { canAccessClaim } from "@/lib/claimAccess";
import { CASE_CATEGORIES, TRANSPORT_MODES } from "@/lib/claimTypes";
import { serializeClaim } from "@/lib/claimSerializer";
import { recordAuditLog } from "@/lib/auditLog";
import Claim from "@/models/Claim";
import Claimant from "@/models/Claimant";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_VIEW);
    const { id } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);
    if (!canAccessClaim(session, claim.reporterId.toString())) {
      return errorResponse("Akses ditolak: bukan klaim milik Anda", 403);
    }

    const claimant = await Claimant.findById(claim.claimantId);
    return successResponse(serializeClaim(claim, claimant));
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_CREATE);
    const { id } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);
    if (claim.reporterId.toString() !== session.sub) {
      return errorResponse("Akses ditolak: bukan klaim milik Anda", 403);
    }
    if (claim.status !== "draft") {
      return errorResponse("Klaim hanya bisa diubah selagi berstatus draft", 409);
    }

    const body = await request.json();
    const before = claim.toObject();

    if (body.accidentDate) claim.accidentDate = new Date(body.accidentDate);
    if (typeof body.accidentLocation === "string") claim.accidentLocation = body.accidentLocation;
    if (typeof body.accidentDescription === "string")
      claim.accidentDescription = body.accidentDescription;
    if (body.transportMode) {
      if (!TRANSPORT_MODES.includes(body.transportMode)) {
        return errorResponse(`transportMode tidak valid: ${body.transportMode}`, 400);
      }
      claim.transportMode = body.transportMode;
    }
    if (body.caseCategory) {
      if (!CASE_CATEGORIES.includes(body.caseCategory)) {
        return errorResponse(`caseCategory tidak valid: ${body.caseCategory}`, 400);
      }
      claim.caseCategory = body.caseCategory;
    }
    if (typeof body.disabilityPercentage === "number")
      claim.disabilityPercentage = body.disabilityPercentage;
    if (typeof body.claimedTreatmentCost === "number")
      claim.claimedTreatmentCost = body.claimedTreatmentCost;

    await claim.save();

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "claim_updated",
      target: "claim",
      targetId: claim._id,
      before: {
        accidentLocation: before.accidentLocation,
        caseCategory: before.caseCategory,
        transportMode: before.transportMode,
      },
      after: {
        accidentLocation: claim.accidentLocation,
        caseCategory: claim.caseCategory,
        transportMode: claim.transportMode,
      },
    });

    const claimant = await Claimant.findById(claim.claimantId);
    return successResponse(serializeClaim(claim, claimant), "Klaim berhasil diperbarui");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
