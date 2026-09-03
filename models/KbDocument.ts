import mongoose, { Schema, models, model, Types } from "mongoose";

export type KbSourceType = "text" | "markdown" | "pdf";

export interface IKbDocument {
  title: string;
  category: string;
  sourceType: KbSourceType;
  rawText: string;
  chunkCount: number;
  isActive: boolean;
  uploadedBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const KbDocumentSchema = new Schema<IKbDocument>(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    sourceType: { type: String, enum: ["text", "markdown", "pdf"], required: true },
    rawText: { type: String, required: true },
    chunkCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default (models.KbDocument as mongoose.Model<IKbDocument>) ||
  model<IKbDocument>("KbDocument", KbDocumentSchema);
