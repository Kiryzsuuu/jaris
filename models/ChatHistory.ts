import mongoose, { Schema, models, model, Types } from "mongoose";

export interface IChatSource {
  documentId: Types.ObjectId;
  documentTitle: string;
  chunkIndex: number;
  score: number;
}

export interface IChatHistory {
  conversationId: string;
  userId: Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  sources: IChatSource[];
  isGrounded: boolean;
  createdAt?: Date;
}

const ChatSourceSchema = new Schema<IChatSource>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "KbDocument", required: true },
    documentTitle: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    score: { type: Number, required: true },
  },
  { _id: false }
);

const ChatHistorySchema = new Schema<IChatHistory>(
  {
    conversationId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: { type: [ChatSourceSchema], default: [] },
    isGrounded: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChatHistorySchema.index({ userId: 1, conversationId: 1, createdAt: 1 });

export default (models.ChatHistory as mongoose.Model<IChatHistory>) ||
  model<IChatHistory>("ChatHistory", ChatHistorySchema);
