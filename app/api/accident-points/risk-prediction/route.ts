import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { computeAccidentRisk } from "@/lib/accidentRiskAgent";
import { ACCIDENT_VEHICLE_TYPES, type AccidentVehicleType } from "@/models/AccidentPoint";

/**
 * On-demand accident risk estimate for a branch/time/vehicle-type
 * combination. Deterministic statistics over real AccidentPoint history
 * (see lib/accidentRiskAgent.ts) with an LLM narrating the already-computed
 * factors. Advisory only - a small-sample historical estimate, not a
 * certified prediction.
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.MAP_VIEW);

    const body = await request.json();

    if (typeof body.branch !== "string" || !body.branch.trim()) {
      return errorResponse("branch wajib diisi", 400);
    }
    if (typeof body.dateTime !== "string") {
      return errorResponse("dateTime wajib diisi", 400);
    }
    const dateTime = new Date(body.dateTime);
    if (isNaN(dateTime.getTime())) {
      return errorResponse("dateTime tidak valid", 400);
    }
    if (!ACCIDENT_VEHICLE_TYPES.includes(body.vehicleType)) {
      return errorResponse(`vehicleType harus salah satu dari: ${ACCIDENT_VEHICLE_TYPES.join(", ")}`, 400);
    }

    const result = await computeAccidentRisk({
      branch: body.branch.trim(),
      dateTime,
      vehicleType: body.vehicleType as AccidentVehicleType,
    });

    return successResponse(result, `Estimasi risiko: ${result.riskLevel} (${result.riskScore}/100)`);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
