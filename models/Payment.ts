import mongoose, { Schema, models, model, Types } from "mongoose";

export interface IPayment {
  claimId: Types.ObjectId;
  amount: number;
  method: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  reference?: string;
  notes?: string;
  recordedBy: Types.ObjectId;
  recordedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: "Claim", required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, required: true, default: "transfer_bank" },
    bankName: { type: String },
    bankAccountNumber: { type: String },
    bankAccountHolder: { type: String },
    reference: { type: String },
    notes: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recordedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

export default (models.Payment as mongoose.Model<IPayment>) ||
  model<IPayment>("Payment", PaymentSchema);
