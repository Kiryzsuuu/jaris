import mongoose, { Schema, models, model, Types } from "mongoose";

export interface IBroadcast {
  title: string;
  message: string;
  audience: "all" | string; // "all" or a role slug
  audienceLabel: string;
  createdBy: Types.ObjectId;
  createdByName: string;
  recipientCount: number;
  emailsSent: number;
  createdAt?: Date;
}

const BroadcastSchema = new Schema<IBroadcast>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    audience: { type: String, required: true },
    audienceLabel: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
    recipientCount: { type: Number, required: true, default: 0 },
    emailsSent: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

BroadcastSchema.index({ createdAt: -1 });

export default (models.Broadcast as mongoose.Model<IBroadcast>) ||
  model<IBroadcast>("Broadcast", BroadcastSchema);
