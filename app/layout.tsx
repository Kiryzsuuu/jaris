import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { connectToDatabase } from "@/lib/mongodb";
import { getSiteSettings, serializeSiteSettings } from "@/lib/siteSettings";
import { deriveColorScale } from "@/lib/colorUtils";

// Matches the Berry admin template's default theme font (config.js: fontFamily: "'Roboto', sans-serif").
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

// Site Settings (name/logo/favicon/accent color/footer) are admin-editable
// at runtime via Pengaturan Situs. Without this, Next.js has no fetch()-
// based signal to detect that the root layout depends on live data (the
// mongoose driver is invisible to its static-vs-dynamic analysis), so it
// silently prerenders this layout once at build time - meaning every saved
// change here would only ever show up after the next redeploy.
export const dynamic = "force-dynamic";

const FALLBACK_SETTINGS = {
  siteName: "JARIS",
  tagline: "Jasa Raharja Integrated Intelligence System",
  logoDataUrl: null,
  faviconDataUrl: null,
  heroImageDataUrl: null,
  sectionImageDataUrl: null,
  heroHeadline: "Satu sistem, seluruh kecerdasan operasional Jasa Raharja",
  heroSubheadline:
    "JARIS menyatukan klaim, santunan, asisten AI, analitik, dan peta risiko kecelakaan dalam satu ekosistem cerdas.",
  primaryColor: "#0B2A55",
  secondaryColor: "#155C9B",
  aiColor: "#1B85C9",
  highlightColor: "#29B6E8",
  accentColor: "#16A3AE",
  backgroundColor: "#F5F6F7",
  sidebarColor: "#0B2A55",
  footerText: "PT Nusa Inspira Teknologi",
};

async function loadSettings() {
  try {
    await connectToDatabase();
    const settings = await getSiteSettings();
    return serializeSiteSettings(settings);
  } catch {
    // Fall back to defaults if the database is unreachable (e.g. env not
    // configured yet) so the app still renders instead of crashing.
    return FALLBACK_SETTINGS;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings();
  return {
    title: settings.siteName,
    description: "AI-Powered Digital Ecosystem - PT Jasa Raharja (Persero)",
    icons: settings.faviconDataUrl ? { icon: settings.faviconDataUrl } : undefined,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await loadSettings();

  const primary = deriveColorScale(settings.primaryColor);
  const secondary = deriveColorScale(settings.secondaryColor);
  const ai = deriveColorScale(settings.aiColor);
  const highlight = deriveColorScale(settings.highlightColor);
  const accent = deriveColorScale(settings.accentColor);

  const cssVars = [
    ...Object.entries(primary).map(([stop, value]) => `--primary-${stop}:${value};`),
    ...Object.entries(secondary).map(([stop, value]) => `--color-secondary-${stop}:${value};`),
    `--color-secondary:${secondary[500]};`,
    ...Object.entries(ai).map(([stop, value]) => `--ai-${stop}:${value};`),
    ...Object.entries(highlight).map(([stop, value]) => `--highlight-${stop}:${value};`),
    ...Object.entries(accent).map(([stop, value]) => `--accent-${stop}:${value};`),
    `--color-theme-bodybg:${settings.backgroundColor};`,
    `--brand-bg:${settings.backgroundColor};`,
    `--color-theme-sidebarbg:${settings.sidebarColor};`,
  ].join("");

  return (
    <html lang="id" className={roboto.variable}>
      <head>
        {/* Full brand palette (Pengaturan Situs) - overrides the template's
            default color scales, computed server-side so there's no flash
            of the default colors. Card/input backgrounds intentionally stay
            pure white/fixed - not admin-configurable, to avoid a picked
            color making card content unreadable against itself. */}
        <style>{`:root{${cssVars}}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
