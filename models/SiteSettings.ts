import mongoose, { Schema, models, model } from "mongoose";

export interface ISiteSettings {
  singleton: "main";
  siteName: string;
  tagline: string;
  logoBase64: string | null;
  logoMimeType: string | null;
  faviconBase64: string | null;
  faviconMimeType: string | null;
  heroImageBase64: string | null;
  heroImageMimeType: string | null;
  heroHeadline: string;
  heroSubheadline: string;
  primaryColor: string;
  footerText: string;
  updatedAt?: Date;
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    // Always "main" so there is exactly one settings document (upsert target).
    singleton: { type: String, enum: ["main"], required: true, unique: true, default: "main" },
    siteName: { type: String, required: true, default: "JARIS" },
    tagline: {
      type: String,
      required: true,
      default: "Jasa Raharja Integrated Intelligence System",
    },
    logoBase64: { type: String, default: null },
    logoMimeType: { type: String, default: null },
    faviconBase64: { type: String, default: null },
    faviconMimeType: { type: String, default: null },
    heroImageBase64: { type: String, default: null },
    heroImageMimeType: { type: String, default: null },
    heroHeadline: {
      type: String,
      required: true,
      default: "Satu sistem, seluruh kecerdasan operasional Jasa Raharja",
    },
    heroSubheadline: {
      type: String,
      required: true,
      default:
        "JARIS menyatukan klaim, santunan, asisten AI, analitik, dan peta risiko kecelakaan dalam satu ekosistem cerdas.",
    },
    primaryColor: { type: String, required: true, default: "#0A3D91" },
    footerText: {
      type: String,
      required: true,
      default: "PT Jasa Raharja (Persero) - Internal Use Only",
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export default (models.SiteSettings as mongoose.Model<ISiteSettings>) ||
  model<ISiteSettings>("SiteSettings", SiteSettingsSchema);
