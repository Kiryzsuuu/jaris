import mongoose, { Schema, models, model } from "mongoose";

export interface ISiteSettings {
  singleton: "main";
  siteName: string;
  tagline: string;
  logoBase64: string | null;
  logoMimeType: string | null;
  faviconBase64: string | null;
  faviconMimeType: string | null;
  // Ordered list of hero banner images shown as an auto-rotating
  // slideshow on the landing page. Empty array = plain background.
  heroImages: { base64: string; mimeType: string }[];
  sectionImageBase64: string | null;
  sectionImageMimeType: string | null;
  loginImageBase64: string | null;
  loginImageMimeType: string | null;
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
  // Keyed by LandingCard.slug (lib/landingContent.ts) - optional image an
  // admin can attach to any landing-page flow/capability card, shown in
  // its detail modal.
  cardImages: Map<string, { base64: string; mimeType: string }>;
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
    heroImages: {
      type: [new Schema({ base64: String, mimeType: String }, { _id: false })],
      default: () => [],
    },
    // Optional supporting image an admin can upload to fill in the claim-
    // flow section on the landing page, so it isn't just icons/text on a
    // fresh install with no other imagery configured.
    sectionImageBase64: { type: String, default: null },
    sectionImageMimeType: { type: String, default: null },
    // Optional background image for the login page's left visual panel
    // (behind the dark gradient overlay so the text stays readable).
    loginImageBase64: { type: String, default: null },
    loginImageMimeType: { type: String, default: null },
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
    // Jasa Raharja palette from the approved redesign mockup: navy as the
    // dominant brand color, blue for accents/active states, gold reserved
    // for small highlights (badges, active markers, key figures).
    primaryColor: { type: String, required: true, default: "#0B2D6B" }, // Navy - buttons/links/header/hero
    secondaryColor: { type: String, required: true, default: "#1B4FA0" }, // Blue - secondary elements
    aiColor: { type: String, required: true, default: "#1B4FA0" }, // Blue - gradient partner / active states
    highlightColor: { type: String, required: true, default: "#F2A900" }, // Gold - highlights/badges
    accentColor: { type: String, required: true, default: "#F2A900" }, // Gold - small accents
    backgroundColor: { type: String, required: true, default: "#F8FAFC" }, // Slate-50 - page canvas
    // Solid background color for the admin app's sidebar/nav.
    sidebarColor: { type: String, required: true, default: "#0B2D6B" },
    footerText: {
      type: String,
      required: true,
      default: "PT Nusa Inspira Teknologi",
    },
    cardImages: {
      type: Map,
      of: new Schema({ base64: String, mimeType: String }, { _id: false }),
      default: () => new Map(),
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export default (models.SiteSettings as mongoose.Model<ISiteSettings>) ||
  model<ISiteSettings>("SiteSettings", SiteSettingsSchema);
