import type { HydratedDocument } from "mongoose";
import type { IClaim } from "@/models/Claim";
import type { IClaimant } from "@/models/Claimant";

export function serializeClaim(
  claim: HydratedDocument<IClaim>,
  claimant?: HydratedDocument<IClaimant> | null
) {
  return {
    id: claim._id.toString(),
    claimNumber: claim.claimNumber,
    status: claim.status,
    reporterId: claim.reporterId.toString(),
    branch: claim.branch,
    claimant: claimant
      ? {
          id: claimant._id.toString(),
          fullName: claimant.fullName,
          nik: claimant.nik,
          relationshipToVictim: claimant.relationshipToVictim,
          phone: claimant.phone ?? null,
          address: claimant.address ?? null,
          bankName: claimant.bankName ?? null,
          bankAccountNumber: claimant.bankAccountNumber ?? null,
          bankAccountHolder: claimant.bankAccountHolder ?? null,
        }
      : { id: claim.claimantId.toString() },
    accidentDate: claim.accidentDate,
    accidentLocation: claim.accidentLocation,
    accidentDescription: claim.accidentDescription,
    transportMode: claim.transportMode,
    caseCategory: claim.caseCategory,
    disabilityPercentage: claim.disabilityPercentage ?? null,
    claimedTreatmentCost: claim.claimedTreatmentCost ?? null,
    documents: claim.documents.map((d) => ({
      id: d._id?.toString(),
      type: d.type,
      fileName: d.fileName,
      mimeType: d.mimeType,
      uploadedBy: d.uploadedBy.toString(),
      uploadedAt: d.uploadedAt,
    })),
    estimatedAmount: claim.estimatedAmount ?? null,
    approvedAmount: claim.approvedAmount ?? null,
    verification: claim.verification
      ? {
          verifiedBy: claim.verification.verifiedBy.toString(),
          verifiedAt: claim.verification.verifiedAt,
          notes: claim.verification.notes ?? null,
        }
      : null,
    approval: claim.approval
      ? {
          approvedBy: claim.approval.approvedBy.toString(),
          approvedAt: claim.approval.approvedAt,
          notes: claim.approval.notes ?? null,
        }
      : null,
    rejection: claim.rejection
      ? {
          rejectedBy: claim.rejection.rejectedBy.toString(),
          rejectedAt: claim.rejection.rejectedAt,
          reason: claim.rejection.reason,
        }
      : null,
    createdAt: claim.get("createdAt"),
    updatedAt: claim.get("updatedAt"),
  };
}
