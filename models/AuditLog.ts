import mongoose, { Schema, models, model, Types } from "mongoose";

export interface IAuditLog {
  actorId: Types.ObjectId | null;
  actorEmail: string | null;
  action: string;
  target: string;
  targetId?: Types.ObjectId | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  createdAt?: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, default: null },
    action: { type: String, required: true },
    target: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, default: null },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default (models.AuditLog as mongoose.Model<IAuditLog>) ||
  model<IAuditLog>("AuditLog", AuditLogSchema);
