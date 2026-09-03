import mongoose, { Schema, models, model } from "mongoose";

export interface IClaimant {
  fullName: string;
  nik: string;
  relationshipToVictim: string;
  phone?: string;
  address?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  isDemo?: boolean;
}

const ClaimantSchema = new Schema<IClaimant>(
  {
    fullName: { type: String, required: true, trim: true },
    nik: { type: String, required: true, trim: true },
    relationshipToVictim: { type: String, required: true, trim: true },
    phone: { type: String },
    address: { type: String },
    bankName: { type: String },
    bankAccountNumber: { type: String },
    bankAccountHolder: { type: String },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default (models.Claimant as mongoose.Model<IClaimant>) ||
  model<IClaimant>("Claimant", ClaimantSchema);
