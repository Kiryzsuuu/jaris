import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { createUser, serializeUser, UserServiceError } from "@/lib/userService";
import { recordAuditLog } from "@/lib/auditLog";
import { sendMailSafe } from "@/lib/mailer";
import { welcomeEmail } from "@/lib/emailTemplates";

// Admin-only user creation. There is no public self-registration endpoint.
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.USER_MANAGE);

    const body = await request.json();
    const { user, role } = await createUser({
      name: body.name,
      email: body.email,
      password: body.password,
      roleId: body.roleId,
      branch: body.branch,
    });

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "user_registered",
      target: "user",
      targetId: user._id,
      after: { name: user.name, email: user.email, roleId: role._id.toString() },
    });

    const { subject, text } = welcomeEmail({
      name: user.name,
      email: user.email,
      password: body.password,
      roleName: role.name,
    });
    await sendMailSafe({ to: user.email, subject, text });

    return successResponse(serializeUser(user, role), "Pengguna berhasil dibuat", 201);
  } catch (error) {
    if (error instanceof UserServiceError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    return handleApiError(error);
  }
}
