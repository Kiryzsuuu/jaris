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
      primaryColor: "#2196f3",
      footerText: "PT Jasa Raharja (Persero) - Internal Use Only",
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
