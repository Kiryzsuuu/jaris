import mongoose, { Schema, models, model, Types } from "mongoose";
import { CASE_CATEGORIES, CLAIM_STATUSES, TRANSPORT_MODES, type CaseCategory, type ClaimStatus, type TransportMode } from "@/lib/claimTypes";

export interface IClaimDocument {
  _id?: Types.ObjectId;
  type: string;
  fileName: string;
  mimeType: string;
  fileBase64: string;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

export interface IClaim {
  claimNumber: string;
  reporterId: Types.ObjectId;
  branch: string;
  claimantId: Types.ObjectId;
  accidentDate: Date;
  accidentLocation: string;
  accidentDescription: string;
  transportMode: TransportMode;
  caseCategory: CaseCategory;
  disabilityPercentage?: number | null;
  claimedTreatmentCost?: number | null;
  status: ClaimStatus;
  submittedAt?: Date | null;
  documents: IClaimDocument[];
  estimatedAmount: number | null;
  approvedAmount: number | null;
  verification?: {
    verifiedBy: Types.ObjectId;
    verifiedAt: Date;
    notes?: string;
  } | null;
  approval?: {
    approvedBy: Types.ObjectId;
    approvedAt: Date;
    notes?: string;
  } | null;
  rejection?: {
    rejectedBy: Types.ObjectId;
    rejectedAt: Date;
    reason: string;
  } | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ClaimDocumentSchema = new Schema<IClaimDocument>(
  {
    type: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileBase64: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const ClaimSchema = new Schema<IClaim>(
  {
    claimNumber: { type: String, required: true, unique: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Denormalized from the reporter's branch at creation time, so dashboard
    // aggregation by wilayah/cabang doesn't need a $lookup into users.
    branch: { type: String, required: true, trim: true },
    claimantId: { type: Schema.Types.ObjectId, ref: "Claimant", required: true },
    accidentDate: { type: Date, required: true },
    accidentLocation: { type: String, required: true },
    accidentDescription: { type: String, required: true },
    transportMode: { type: String, enum: TRANSPORT_MODES, required: true },
    caseCategory: { type: String, enum: CASE_CATEGORIES, required: true },
    disabilityPercentage: { type: Number, min: 0, max: 100, default: null },
    claimedTreatmentCost: { type: Number, min: 0, default: null },
    status: { type: String, enum: CLAIM_STATUSES, required: true, default: "draft" },
    submittedAt: { type: Date, default: null },
    documents: { type: [ClaimDocumentSchema], default: [] },
    estimatedAmount: { type: Number, default: null },
    approvedAmount: { type: Number, default: null },
    verification: {
      type: new Schema(
        {
          verifiedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          verifiedAt: { type: Date, required: true },
          notes: { type: String },
        },
        { _id: false }
      ),
      default: null,
    },
    approval: {
      type: new Schema(
        {
          approvedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          approvedAt: { type: Date, required: true },
          notes: { type: String },
        },
        { _id: false }
      ),
      default: null,
    },
    rejection: {
      type: new Schema(
        {
          rejectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          rejectedAt: { type: Date, required: true },
          reason: { type: String, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);

ClaimSchema.index({ reporterId: 1, status: 1 });
ClaimSchema.index({ status: 1, createdAt: -1 });
ClaimSchema.index({ branch: 1, status: 1 });
ClaimSchema.index({ accidentDate: 1 });

export default (models.Claim as mongoose.Model<IClaim>) || model<IClaim>("Claim", ClaimSchema);
