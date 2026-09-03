import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import Claim from "@/models/Claim";
import Payment from "@/models/Payment";
import AccidentPoint from "@/models/AccidentPoint";
import User from "@/models/User";

// Public, aggregate-only counts for the landing page "live" stats strip.
// No claimant/user PII - just counts and a sum, safe to expose pre-login.
export async function GET() {
  try {
    await connectToDatabase();

    const [totalClaims, totalPaidAgg, totalAccidentPoints, totalActiveUsers] = await Promise.all([
      Claim.countDocuments({}),
      Payment.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
      AccidentPoint.countDocuments({}),
      User.countDocuments({ isActive: true }),
    ]);

    return successResponse(
      {
        totalClaims,
        totalPaidAmount: totalPaidAgg[0]?.total ?? 0,
        totalAccidentPoints,
        totalActiveUsers,
      },
      "Statistik publik"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
