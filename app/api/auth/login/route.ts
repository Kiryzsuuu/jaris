import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import User from "@/models/User";
import Role from "@/models/Role";
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth";
import { recordAuditLog } from "@/lib/auditLog";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return errorResponse("Email dan password wajib diisi", 400);
    }

    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return errorResponse("Email atau password salah", 401);
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await recordAuditLog({
        actorId: user._id,
        actorEmail: user.email,
        action: "login_failed",
        target: "user",
        targetId: user._id,
      });
      return errorResponse("Email atau password salah", 401);
    }

    const role = await Role.findById(user.roleId);
    if (!role) {
      return errorResponse("Peran pengguna tidak ditemukan, hubungi admin", 500);
    }

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      roleId: role._id.toString(),
      roleSlug: role.slug,
      permissions: role.permissions,
    });
    const refreshToken = signRefreshToken({ sub: user._id.toString() });

    user.lastLoginAt = new Date();
    await user.save();

    await recordAuditLog({
      actorId: user._id,
      actorEmail: user.email,
      action: "login_success",
      target: "user",
      targetId: user._id,
    });

    const response = successResponse(
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: { id: role._id.toString(), name: role.name, slug: role.slug },
          permissions: role.permissions,
        },
      },
      "Login berhasil"
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
