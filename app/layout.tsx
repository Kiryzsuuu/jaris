import type { Metadata } from "next";
import { Nunito, Inter } from "next/font/google";
import "./globals.css";
import { connectToDatabase } from "@/lib/mongodb";
import { getSiteSettings, serializeSiteSettings } from "@/lib/siteSettings";
import { deriveColorScale } from "@/lib/colorUtils";

// Matches the Mazer admin template's default theme font. Used for the
// authenticated app (AppShell/.mazer-admin) - the admin restyle's font.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  variable: "--font-nunito",
});

// The public landing/login pages use a separate, more neutral typeface
// (globals.css scopes this to .landing-page/.login-shell) rather than the
// admin's Nunito.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
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
  heroImageDataUrls: [] as string[],
  sectionImageDataUrl: null,
  heroHeadline: "Satu sistem, seluruh kecerdasan operasional Jasa Raharja",
  heroSubheadline:
    "JARIS menyatukan klaim, santunan, asisten AI, analitik, dan peta risiko kecelakaan dalam satu ekosistem cerdas.",
  primaryColor: "#29B6E8",
  secondaryColor: "#0A2A5C",
  aiColor: "#1668C4",
  highlightColor: "#1668C4",
  accentColor: "#29B6E8",
  backgroundColor: "#F7F8FA",
  sidebarColor: "#0A2A5C",
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
    title: {
      default: `${settings.siteName} — ${settings.tagline}`,
      template: `%s · ${settings.siteName}`,
    },
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
    <html lang="id" className={`${nunito.variable} ${inter.variable}`}>
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
