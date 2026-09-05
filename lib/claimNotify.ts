import User from "@/models/User";
import { sendMailSafe } from "@/lib/mailer";
import { claimStatusEmail } from "@/lib/emailTemplates";
import type { Types } from "mongoose";

export async function notifyClaimStatusChange(params: {
  reporterId: Types.ObjectId | string;
  claimNumber: string;
  status: "verified" | "approved" | "rejected" | "paid" | "returned";
  note?: string;
}) {
  const reporter = await User.findById(params.reporterId);
  if (!reporter?.email) return;

  const { subject, text } = claimStatusEmail({
    reporterName: reporter.name,
    claimNumber: params.claimNumber,
    status: params.status,
    note: params.note,
  });

  await sendMailSafe({ to: reporter.email, subject, text });
}
