import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import User from "@/models/User";
import Role from "@/models/Role";
import {
  signAccessToken,
  verifyRefreshToken,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken) {
      return errorResponse("Refresh token tidak ditemukan", 401);
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return errorResponse("Refresh token tidak valid atau kedaluwarsa", 401);
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      return errorResponse("Pengguna tidak ditemukan atau nonaktif", 401);
    }

    const role = await Role.findById(user.roleId);
    if (!role) {
      return errorResponse("Peran pengguna tidak ditemukan", 500);
    }

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      roleId: role._id.toString(),
      roleSlug: role.slug,
      permissions: role.permissions,
    });

    const response = successResponse(null, "Token diperbarui");
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
