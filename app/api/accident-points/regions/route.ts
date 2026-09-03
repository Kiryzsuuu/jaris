import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import AccidentPoint from "@/models/AccidentPoint";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.MAP_VIEW);

    const [branches, provinces] = await Promise.all([
      AccidentPoint.distinct("branch"),
      AccidentPoint.distinct("province"),
    ]);

    return successResponse(
      { branches: (branches as string[]).sort(), provinces: (provinces as string[]).sort() },
      "Daftar wilayah titik kecelakaan"
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
