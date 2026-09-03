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

async function loadSettings() {
  try {
    await connectToDatabase();
    const settings = await getSiteSettings();
    return serializeSiteSettings(settings);
  } catch {
    // Fall back to defaults if the database is unreachable (e.g. env not
    // configured yet) so the app still renders instead of crashing.
    return {
      siteName: "JARIS",
      tagline: "Jasa Raharja Integrated Intelligence System",
      logoDataUrl: null,
      faviconDataUrl: null,
      heroImageDataUrl: null,
      heroHeadline: "Satu sistem, seluruh kecerdasan operasional Jasa Raharja",
      heroSubheadline:
        "JARIS menyatukan klaim, santunan, asisten AI, analitik, dan peta risiko kecelakaan dalam satu ekosistem cerdas.",
      primaryColor: "#0A3D91",
      footerText: "PT Nusa Inspira Teknologi",
    };
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
  const scale = deriveColorScale(settings.primaryColor);

  return (
    <html lang="id" className={roboto.variable}>
      <head>
        {/* Admin-configurable accent color (Pengaturan Situs) - overrides the
            template's default --primary-* scale everywhere it's used,
            computed server-side so there's no flash of the default color. */}
        <style>{`:root{${Object.entries(scale)
          .map(([stop, value]) => `--primary-${stop}:${value};`)
          .join("")}}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
