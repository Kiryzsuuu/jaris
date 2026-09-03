import { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken, type AccessTokenPayload } from "@/lib/auth";
import { errorResponse } from "@/lib/apiResponse";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function getSession(request: NextRequest): AccessTokenPayload {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    throw new AuthError("Belum login / token tidak ditemukan", 401);
  }

  try {
    return verifyAccessToken(token);
  } catch {
    throw new AuthError("Sesi tidak valid atau kedaluwarsa", 401);
  }
}

export function requirePermission(
  request: NextRequest,
  permission: string
): AccessTokenPayload {
  const session = getSession(request);

  if (!session.permissions.includes(permission)) {
    throw new AuthError(`Akses ditolak: memerlukan permission '${permission}'`, 403);
  }

  return session;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return errorResponse(error.message, error.status);
  }
  return errorResponse("Unauthorized", 401);
}
