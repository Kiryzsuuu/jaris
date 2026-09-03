import { NextRequest } from "next/server";
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
import Payment from "@/models/Payment";

type Params = { params: Promise<{ id: string }> };

// Recording only - actual fund disbursement is not executed by the system
// (see PRD §9: out of scope for direct banking/payment integration).
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_APPROVE);
    const { id } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);
    if (!isValidStatusTransition(claim.status, "paid")) {
      return errorResponse(`Tidak bisa mencatat pencairan dari status '${claim.status}'`, 409);
    }
    if (claim.approvedAmount === null) {
      return errorResponse("Klaim belum memiliki approvedAmount", 409);
    }

    const claimant = await Claimant.findById(claim.claimantId);
    const body = await request.json();

    const payment = await Payment.create({
      claimId: claim._id,
      amount: claim.approvedAmount,
      method: body.method || "transfer_bank",
      bankName: body.bankName ?? claimant?.bankName,
      bankAccountNumber: body.bankAccountNumber ?? claimant?.bankAccountNumber,
      bankAccountHolder: body.bankAccountHolder ?? claimant?.bankAccountHolder,
      reference: body.reference,
      notes: body.notes,
      recordedBy: session.sub,
      recordedAt: new Date(),
    });

    const before = { status: claim.status };
    claim.status = "paid";
    await claim.save();

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "claim_paid",
      target: "claim",
      targetId: claim._id,
      before,
      after: { status: claim.status, paymentId: payment._id.toString(), amount: payment.amount },
    });

    await notifyClaimStatusChange({
      reporterId: claim.reporterId,
      claimNumber: claim.claimNumber,
      status: "paid",
      note: `Jumlah dicairkan: Rp${payment.amount.toLocaleString("id-ID")}`,
    });

    return successResponse(
      { claim: serializeClaim(claim, claimant), payment: { id: payment._id.toString(), amount: payment.amount } },
      "Pencairan santunan berhasil dicatat"
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
