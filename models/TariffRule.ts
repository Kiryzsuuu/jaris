import mongoose, { Schema, models, model } from "mongoose";
import { CASE_CATEGORIES, TRANSPORT_MODES, type CaseCategory, type TransportMode } from "@/lib/claimTypes";

export interface ITariffRule {
  category: CaseCategory;
  transportMode: TransportMode;
  maxAmount: number;
  description: string;
  isActive: boolean;
  effectiveDate: Date;
}

const TariffRuleSchema = new Schema<ITariffRule>(
  {
    category: { type: String, enum: CASE_CATEGORIES, required: true },
    transportMode: { type: String, enum: TRANSPORT_MODES, required: true },
    maxAmount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    effectiveDate: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

TariffRuleSchema.index({ category: 1, transportMode: 1, isActive: 1 });

export default (models.TariffRule as mongoose.Model<ITariffRule>) ||
  model<ITariffRule>("TariffRule", TariffRuleSchema);
