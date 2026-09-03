import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, getSession, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { sendMailSafe } from "@/lib/mailer";
import { recordAuditLog } from "@/lib/auditLog";
import Broadcast from "@/models/Broadcast";
import Role from "@/models/Role";
import User from "@/models/User";

// Any logged-in user can read the announcement history (it's shown as a
// dismissible banner across the app) - only broadcast:manage can send one.
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    getSession(request);

    const broadcasts = await Broadcast.find().sort({ createdAt: -1 }).limit(20);
    const data = broadcasts.map((b) => ({
      id: b._id.toString(),
      title: b.title,
      message: b.message,
      audienceLabel: b.audienceLabel,
      createdByName: b.createdByName,
      recipientCount: b.recipientCount,
      emailsSent: b.emailsSent,
      createdAt: b.get("createdAt"),
    }));

    return successResponse(data, "Riwayat broadcast");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

// Sends an in-app announcement (read via GET above) and, best-effort, an
// email to every matching active user via the same Gmail SMTP transport
// already used for claim-status notifications. Email failures per-recipient
// are swallowed (sendMailSafe) so one bad address never blocks the rest.
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.BROADCAST_MANAGE);

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const audience = typeof body.audience === "string" ? body.audience : "all";

    if (!title || !message) {
      return errorResponse("title dan message wajib diisi", 400);
    }

    let audienceLabel = "Semua Pengguna";
    let userFilter: Record<string, unknown> = { isActive: true };

    if (audience !== "all") {
      const role = await Role.findOne({ slug: audience });
      if (!role) return errorResponse("Peran audience tidak ditemukan", 400);
      audienceLabel = role.name;
      userFilter = { isActive: true, roleId: role._id };
    }

    const recipients = await User.find(userFilter).select("email name");

    let emailsSent = 0;
    // Capped so a very large recipient list can't turn one request into a
    // long-running mail blast that ties up the server - internal user base
    // is small (dozens, not thousands), so this ceiling is generous.
    const MAX_EMAILS = 500;
    for (const user of recipients.slice(0, MAX_EMAILS)) {
      const ok = await sendMailSafe({
        to: user.email,
        subject: `[JARIS] ${title}`,
        text: `Halo ${user.name},\n\n${message}\n\n— Dikirim melalui JARIS oleh ${session.email}`,
      });
      if (ok) emailsSent += 1;
    }

    const broadcast = await Broadcast.create({
      title,
      message,
      audience,
      audienceLabel,
      createdBy: session.sub,
      createdByName: session.email,
      recipientCount: recipients.length,
      emailsSent,
    });

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "broadcast_sent",
      target: "broadcast",
      targetId: broadcast._id,
      after: { title, audienceLabel, recipientCount: recipients.length, emailsSent },
    });

    return successResponse(
      { id: broadcast._id.toString(), recipientCount: recipients.length, emailsSent },
      `Broadcast terkirim ke ${recipients.length} pengguna (${emailsSent} email berhasil dikirim)`,
      201
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
