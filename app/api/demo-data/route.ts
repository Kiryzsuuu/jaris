import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { recordAuditLog } from "@/lib/auditLog";
import Claim from "@/models/Claim";
import Claimant from "@/models/Claimant";
import Payment from "@/models/Payment";
import AccidentPoint from "@/models/AccidentPoint";

// Reports how much demo data (scripts/seedDemoData.ts) currently exists, so
// the settings page can show/hide the "Hapus Data Contoh" action.
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.SETTINGS_MANAGE);

    const [claims, claimants, payments, accidentPoints] = await Promise.all([
      Claim.countDocuments({ isDemo: true }),
      Claimant.countDocuments({ isDemo: true }),
      Payment.countDocuments({ isDemo: true }),
      AccidentPoint.countDocuments({ source: "mock" }),
    ]);

    return successResponse({ claims, claimants, payments, accidentPoints }, "Jumlah data contoh");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

// Wipes every record created by scripts/seedDemoData.ts (and any leftover
// mock accident points), leaving real data untouched.
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.SETTINGS_MANAGE);

    const demoClaims = await Claim.find({ isDemo: true }).select("_id");
    const demoClaimIds = demoClaims.map((c) => c._id);

    const [paymentResult, claimResult, claimantResult, accidentResult] = await Promise.all([
      Payment.deleteMany({ $or: [{ isDemo: true }, { claimId: { $in: demoClaimIds } }] }),
      Claim.deleteMany({ isDemo: true }),
      Claimant.deleteMany({ isDemo: true }),
      AccidentPoint.deleteMany({ source: "mock" }),
    ]);

    const summary = {
      claims: claimResult.deletedCount,
      claimants: claimantResult.deletedCount,
      payments: paymentResult.deletedCount,
      accidentPoints: accidentResult.deletedCount,
    };

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "demo_data_deleted",
      target: "demo_data",
      after: summary,
    });

    return successResponse(summary, "Data contoh berhasil dihapus");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
