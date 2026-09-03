import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { getSession, AuthError, authErrorResponse } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import Role from "@/models/Role";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = getSession(request);
    const canView =
      session.permissions.includes(PERMISSIONS.ROLE_VIEW) ||
      session.permissions.includes(PERMISSIONS.USER_MANAGE);
    if (!canView) {
      throw new AuthError("Akses ditolak: memerlukan permission 'role:view'", 403);
    }

    const roles = await Role.find().sort({ name: 1 }).lean();
    const data = roles.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      slug: r.slug,
      description: r.description ?? null,
      permissions: r.permissions,
    }));

    return successResponse(data, "Daftar peran");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
