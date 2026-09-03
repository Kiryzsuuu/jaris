import type { Metadata } from "next";
import "./globals.css";
import { connectToDatabase } from "@/lib/mongodb";
import { getSiteSettings, serializeSiteSettings } from "@/lib/siteSettings";
import { deriveThemeShades } from "@/lib/colorUtils";

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
      primaryColor: "#111827",
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
  const theme = deriveThemeShades(settings.primaryColor);

  return (
    <html lang="id">
      <head>
        <link rel="stylesheet" href="/vendor/spark/libs/bootstrap/css/bootstrap.min.css" />
        <link rel="stylesheet" href="/vendor/spark/libs/bootstrap-icons/bootstrap-icons.css" />
        <link rel="stylesheet" href="/vendor/spark/libs/apexcharts/apexcharts.css" />
        <link rel="stylesheet" href="/vendor/spark/libs/flatpickr/flatpickr.min.css" />
        <link rel="stylesheet" href="/vendor/spark/css/main.css" />
        {/* Admin-configurable accent color (Pengaturan Situs) - overrides the
            template's default lime accent everywhere it's used, computed
            server-side so there's no flash of the default color on load. */}
        <style>{`:root{--brand-lime:${theme.base};--brand-lime-hover:${theme.hover};--brand-lime-translucent:${theme.translucent};--theme-foreground:${theme.foreground};}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
