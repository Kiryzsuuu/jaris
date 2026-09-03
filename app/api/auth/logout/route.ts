import { NextRequest } from "next/server";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, verifyAccessToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { recordAuditLog } from "@/lib/auditLog";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    if (token) {
      try {
        const session = verifyAccessToken(token);
        await recordAuditLog({
          actorId: session.sub,
          actorEmail: session.email,
          action: "logout",
          target: "user",
          targetId: session.sub,
        });
      } catch {
        // token already invalid/expired, nothing to log against
      }
    }

    const response = successResponse(null, "Logout berhasil");
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
