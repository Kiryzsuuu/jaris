import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { serializeUser } from "@/lib/userService";
import { recordAuditLog } from "@/lib/auditLog";
import User from "@/models/User";
import Role from "@/models/Role";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.USER_VIEW);
    const { id } = await params;

    const user = await User.findById(id);
    if (!user) return errorResponse("Pengguna tidak ditemukan", 404);
    const role = await Role.findById(user.roleId);

    return successResponse(serializeUser(user, role));
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.USER_MANAGE);
    const { id } = await params;

    const user = await User.findById(id);
    if (!user) return errorResponse("Pengguna tidak ditemukan", 404);

    const body = await request.json();
    const before = {
      name: user.name,
      roleId: user.roleId.toString(),
      isActive: user.isActive,
    };

    let roleChanged = false;
    if (typeof body.name === "string" && body.name.trim()) {
      user.name = body.name.trim();
    }
    if (typeof body.isActive === "boolean") {
      user.isActive = body.isActive;
    }
    if (typeof body.branch === "string" && body.branch.trim()) {
      user.branch = body.branch.trim();
    }
    if (typeof body.roleId === "string" && body.roleId !== user.roleId.toString()) {
      const role = await Role.findById(body.roleId);
      if (!role) return errorResponse("Role tidak ditemukan", 400);
      user.roleId = role._id;
      roleChanged = true;
    }

    await user.save();
    const role = await Role.findById(user.roleId);

    const after = {
      name: user.name,
      roleId: user.roleId.toString(),
      isActive: user.isActive,
    };

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: roleChanged ? "user_role_changed" : "user_updated",
      target: "user",
      targetId: user._id,
      before,
      after,
    });

    return successResponse(serializeUser(user, role), "Pengguna berhasil diperbarui");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.USER_MANAGE);
    const { id } = await params;

    const user = await User.findById(id);
    if (!user) return errorResponse("Pengguna tidak ditemukan", 404);

    const before = { isActive: user.isActive };
    user.isActive = false;
    await user.save();

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "user_deactivated",
      target: "user",
      targetId: user._id,
      before,
      after: { isActive: false },
    });

    return successResponse(null, "Pengguna dinonaktifkan");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
