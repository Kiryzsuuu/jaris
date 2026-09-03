import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import TariffRule from "@/models/TariffRule";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.CLAIM_VIEW);

    const rules = await TariffRule.find({ isActive: true }).sort({ category: 1, transportMode: 1 });
    const data = rules.map((r) => ({
      id: r._id.toString(),
      category: r.category,
      transportMode: r.transportMode,
      maxAmount: r.maxAmount,
      description: r.description,
      effectiveDate: r.effectiveDate,
    }));

    return successResponse(data, "Daftar tarif santunan");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
