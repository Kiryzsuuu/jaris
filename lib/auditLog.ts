import AuditLog from "@/models/AuditLog";
import type { Types } from "mongoose";

export async function recordAuditLog(params: {
  actorId: Types.ObjectId | string | null;
  actorEmail: string | null;
  action: string;
  target: string;
  targetId?: Types.ObjectId | string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}) {
  await AuditLog.create({
    actorId: params.actorId ?? null,
    actorEmail: params.actorEmail ?? null,
    action: params.action,
    target: params.target,
    targetId: params.targetId ?? null,
    before: params.before ?? null,
    after: params.after ?? null,
    ip: params.ip ?? null,
  });
}
