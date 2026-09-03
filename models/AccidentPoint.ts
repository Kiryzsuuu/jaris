import mongoose, { Schema, models, model, Types } from "mongoose";

export const ACCIDENT_SEVERITIES = ["ringan", "sedang", "berat", "meninggal_dunia"] as const;
export type AccidentSeverity = (typeof ACCIDENT_SEVERITIES)[number];

export const ACCIDENT_VEHICLE_TYPES = ["motor", "mobil", "truk_bus", "lainnya"] as const;
export type AccidentVehicleType = (typeof ACCIDENT_VEHICLE_TYPES)[number];

// "mock" = dummy seed data used until the official Korlantas Polri feed is
// connected; "korlantas_polri" is reserved for real ingested records later.
export const ACCIDENT_SOURCES = ["mock", "korlantas_polri"] as const;
export type AccidentSource = (typeof ACCIDENT_SOURCES)[number];

export interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude] - GeoJSON order
}

export interface IAccidentPoint {
  location: IGeoPoint;
  branch: string;
  province: string;
  city: string;
  accidentDate: Date;
  severity: AccidentSeverity;
  vehicleType: AccidentVehicleType;
  casualtyCount: number;
  description: string;
  source: AccidentSource;
  sourceRef?: string | null;
  relatedClaimId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const GeoPointSchema = new Schema<IGeoPoint>(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) => v.length === 2,
        message: "coordinates harus [longitude, latitude]",
      },
    },
  },
  { _id: false }
);

const AccidentPointSchema = new Schema<IAccidentPoint>(
  {
    // GeoJSON Point - ready for a real Korlantas Polri feed later, which is
    // expected to report this same [lng, lat] shape.
    location: { type: GeoPointSchema, required: true },
    branch: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    accidentDate: { type: Date, required: true },
    severity: { type: String, enum: ACCIDENT_SEVERITIES, required: true },
    vehicleType: { type: String, enum: ACCIDENT_VEHICLE_TYPES, required: true },
    casualtyCount: { type: Number, required: true, min: 0, default: 1 },
    description: { type: String, required: true },
    source: { type: String, enum: ACCIDENT_SOURCES, required: true, default: "mock" },
    sourceRef: { type: String, default: null },
    relatedClaimId: { type: Schema.Types.ObjectId, ref: "Claim", default: null },
  },
  { timestamps: true }
);

// Geospatial index required for $near / $geoNear queries on `location`.
AccidentPointSchema.index({ location: "2dsphere" });
AccidentPointSchema.index({ branch: 1, accidentDate: -1 });
AccidentPointSchema.index({ accidentDate: -1 });

export default (models.AccidentPoint as mongoose.Model<IAccidentPoint>) ||
  model<IAccidentPoint>("AccidentPoint", AccidentPointSchema);
