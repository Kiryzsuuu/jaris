import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { runClaimAuditAgent } from "@/lib/claimAuditAgent";
import { recordAuditLog } from "@/lib/auditLog";
import Claim from "@/models/Claim";
import type { CaseCategory } from "@/lib/claimTypes";

type Params = { params: Promise<{ id: string }> };

// Runs the multi-step claim-audit agent (document-completeness check + AI
// vision on photos + AI synthesis). Restricted to verifiers/approvers - the
// output is advisory only and is never written back to the claim.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_VERIFY);
    const { id } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);

    const result = await runClaimAuditAgent({
      caseCategory: claim.caseCategory as CaseCategory,
      transportMode: claim.transportMode,
      accidentDescription: claim.accidentDescription,
      disabilityPercentage: claim.disabilityPercentage ?? null,
      claimedTreatmentCost: claim.claimedTreatmentCost ?? null,
      estimatedAmount: claim.estimatedAmount ?? null,
      documents: claim.documents.map((d) => ({
        id: d._id?.toString() ?? "",
        type: d.type,
        fileName: d.fileName,
        mimeType: d.mimeType,
        fileBase64: d.fileBase64,
      })),
    });

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "claim_audit_agent_run",
      target: "claim",
      targetId: claim._id,
      after: { recommendation: result.recommendation, flagCount: result.flags.length },
    });

    return successResponse(result, "Audit AI selesai - tetap wajib ditinjau petugas");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
