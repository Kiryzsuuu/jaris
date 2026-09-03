import mongoose, { Schema, models, model, Types } from "mongoose";

export interface IKbEmbedding {
  documentId: Types.ObjectId;
  documentTitle: string;
  chunkIndex: number;
  chunkText: string;
  embedding: number[];
  embeddingDimensions: number;
  createdAt?: Date;
}

// This collection backs MongoDB Atlas Vector Search. The `embedding` field
// requires a manually-created Vector Search index in the Atlas dashboard - // see README "AI Asisten (Phase 3)" for the exact steps. Mongoose cannot
// create that index; it only enforces normal document structure here.
const KbEmbeddingSchema = new Schema<IKbEmbedding>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "KbDocument", required: true },
    documentTitle: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    chunkText: { type: String, required: true },
    embedding: { type: [Number], required: true },
    embeddingDimensions: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

KbEmbeddingSchema.index({ documentId: 1 });

export default (models.KbEmbedding as mongoose.Model<IKbEmbedding>) ||
  model<IKbEmbedding>("KbEmbedding", KbEmbeddingSchema);
