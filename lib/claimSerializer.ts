import type { HydratedDocument } from "mongoose";
import type { IClaim } from "@/models/Claim";
import type { IClaimant } from "@/models/Claimant";

export type ClaimTimelineEntry = {
  label: string;
  actorId: string | null;
  at: Date;
  detail: string | null;
};

/** Chronological status history, built straight from the claim's own status
 * timestamps - no separate audit-log lookup needed for a single claim. */
function buildTimeline(claim: HydratedDocument<IClaim>): ClaimTimelineEntry[] {
  const entries: ClaimTimelineEntry[] = [
    { label: "Klaim diajukan", actorId: claim.reporterId.toString(), at: claim.get("createdAt") ?? new Date(), detail: null },
  ];

  if (claim.submittedAt) {
    entries.push({ label: "Diajukan resmi (submitted)", actorId: claim.reporterId.toString(), at: claim.submittedAt, detail: null });
  }
  if (claim.returnedForRevision) {
    entries.push({
      label: "Dikembalikan untuk revisi",
      actorId: claim.returnedForRevision.returnedBy.toString(),
      at: claim.returnedForRevision.returnedAt,
      detail: claim.returnedForRevision.reason,
    });
  }
  if (claim.verification) {
    entries.push({
      label: "Diverifikasi",
      actorId: claim.verification.verifiedBy.toString(),
      at: claim.verification.verifiedAt,
      detail: claim.verification.notes ?? null,
    });
  }
  if (claim.approval) {
    entries.push({
      label: "Disetujui",
      actorId: claim.approval.approvedBy.toString(),
      at: claim.approval.approvedAt,
      detail: claim.approval.notes ?? null,
    });
  }
  if (claim.rejection) {
    entries.push({
      label: "Ditolak",
      actorId: claim.rejection.rejectedBy.toString(),
      at: claim.rejection.rejectedAt,
      detail: claim.rejection.reason,
    });
  }

  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

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
    vehiclePlateNumber: claim.vehiclePlateNumber ?? null,
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
      reviewStatus: d.reviewStatus,
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
    returnedForRevision: claim.returnedForRevision
      ? {
          returnedBy: claim.returnedForRevision.returnedBy.toString(),
          returnedAt: claim.returnedForRevision.returnedAt,
          reason: claim.returnedForRevision.reason,
        }
      : null,
    fraudDismissedAt: claim.fraudDismissedAt ?? null,
    timeline: buildTimeline(claim),
    createdAt: claim.get("createdAt"),
    updatedAt: claim.get("updatedAt"),
  };
}
