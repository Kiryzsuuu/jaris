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
  sectionImageBase64: string | null;
  sectionImageMimeType: string | null;
  heroHeadline: string;
  heroSubheadline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  highlightColor: string;
  aiColor: string;
  backgroundColor: string;
  sidebarColor: string;
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
    // Optional supporting image an admin can upload to fill in the claim-
    // flow section on the landing page, so it isn't just icons/text on a
    // fresh install with no other imagery configured.
    sectionImageBase64: { type: String, default: null },
    sectionImageMimeType: { type: String, default: null },
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
    // Full brand palette - each color drives a distinct part of the UI so
    // admins can tune the whole look without touching code. Card/input
    // backgrounds intentionally stay pure white (not admin-configurable) -
    // making that editable risks an admin picking a color that makes card
    // content unreadable against itself.
    // Sampled from the NIIIS logo's navy-to-cyan gradient mark.
    primaryColor: { type: String, required: true, default: "#0B2A55" }, // Deep Navy - buttons/links/headings accent
    secondaryColor: { type: String, required: true, default: "#155C9B" }, // Corporate Blue - secondary elements
    aiColor: { type: String, required: true, default: "#1B85C9" }, // AI Blue - gradient midpoint
    highlightColor: { type: String, required: true, default: "#29B6E8" }, // Digital Cyan - AI highlight touches
    accentColor: { type: String, required: true, default: "#16A3AE" }, // Intelligent Teal - general accent
    backgroundColor: { type: String, required: true, default: "#F5F6F7" }, // Soft Light Gray - page canvas
    // Solid background color for the admin app's sidebar/nav.
    sidebarColor: { type: String, required: true, default: "#0B2A55" },
    footerText: {
      type: String,
      required: true,
      default: "PT Nusa Inspira Teknologi",
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export default (models.SiteSettings as mongoose.Model<ISiteSettings>) ||
  model<ISiteSettings>("SiteSettings", SiteSettingsSchema);
