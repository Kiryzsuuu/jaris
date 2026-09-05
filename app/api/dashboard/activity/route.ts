import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import AuditLog from "@/models/AuditLog";
import Claim from "@/models/Claim";

// Human-readable feed for the dashboard's "Aktivitas Terbaru" card, built
// from the existing audit log rather than a separate activity collection.
// Only a curated subset of actions are surfaced, and only a short display
// label is returned (never the raw before/after diff) - this is a glance
// feed, not the full audit trail (that stays behind audit:view).
const ACTION_LABELS: Record<string, { text: string; color: string }> = {
  claim_created: { text: "Klaim baru diajukan", color: "#1B4FA0" },
  claim_submitted: { text: "Klaim resmi diajukan untuk verifikasi", color: "#1B4FA0" },
  claim_verified: { text: "Klaim diverifikasi", color: "#16A34A" },
  claim_approved: { text: "Klaim disetujui", color: "#7C3AED" },
  claim_returned: { text: "Klaim dikembalikan untuk revisi", color: "#F2A900" },
  claim_rejected: { text: "Klaim ditolak", color: "#DC2626" },
  claim_paid: { text: "Pencairan santunan dicatat", color: "#16A34A" },
  fraud_finding_dismissed: { text: "Temuan anomali ditandai sudah ditinjau", color: "#94A3B8" },
  claim_audit_agent_run: { text: "Audit AI dijalankan pada klaim", color: "#1B4FA0" },
  broadcast_sent: { text: "Broadcast dikirim", color: "#7C3AED" },
};

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.DASHBOARD_VIEW);

    const logs = await AuditLog.find({ action: { $in: Object.keys(ACTION_LABELS) } })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    const claimTargetIds = [...new Set(logs.filter((l) => l.target === "claim" && l.targetId).map((l) => l.targetId!.toString()))];
    const claims = await Claim.find({ _id: { $in: claimTargetIds } }).select("claimNumber").lean();
    const claimNumberById = new Map(claims.map((c) => [c._id.toString(), c.claimNumber]));

    const data = logs.map((log) => {
      const meta = ACTION_LABELS[log.action];
      const claimNumber = log.targetId ? claimNumberById.get(log.targetId.toString()) : null;
      let text = claimNumber ? `${meta.text} - ${claimNumber}` : meta.text;
      if (log.action === "broadcast_sent") {
        const after = log.after as { title?: string; recipientCount?: number } | null;
        text = `Broadcast dikirim${after?.title ? `: ${after.title}` : ""}${
          typeof after?.recipientCount === "number" ? ` ke ${after.recipientCount} pengguna` : ""
        }`;
      }
      return {
        id: log._id.toString(),
        text,
        color: meta.color,
        at: (log as unknown as { createdAt: Date }).createdAt,
      };
    });

    return successResponse(data, "Aktivitas terbaru");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
