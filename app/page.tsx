import { connectToDatabase } from "@/lib/mongodb";
import { getSiteSettings, serializeSiteSettings } from "@/lib/siteSettings";
import LandingHome, { type SettingsResponse } from "@/components/LandingHome";

// Same reasoning as app/layout.tsx: Site Settings are admin-editable at
// runtime, and Next.js has no fetch()-based signal to detect that this
// page depends on live data (the mongoose driver is invisible to its
// static-vs-dynamic analysis) - without this it would prerender once at
// build time and every saved settings change would only show up after
// the next redeploy.
export const dynamic = "force-dynamic";

const DEFAULTS: SettingsResponse = {
  siteName: "JARIS",
  logoDataUrl: null,
  heroImageDataUrls: [],
  sectionImageDataUrl: null,
  heroHeadline: "Satu sistem, seluruh kecerdasan operasional Jasa Raharja",
  heroSubheadline:
    "JARIS menyatukan klaim, santunan, asisten AI, analitik, dan peta risiko kecelakaan dalam satu ekosistem cerdas.",
  footerText: "PT Nusa Inspira Teknologi",
  cardImages: {},
};

async function loadSettings(): Promise<SettingsResponse> {
  try {
    await connectToDatabase();
    const settings = await getSiteSettings();
    return serializeSiteSettings(settings);
  } catch {
    // Fall back to defaults if the database is unreachable so the landing
    // page still renders instead of crashing.
    return DEFAULTS;
  }
}

// Server component: settings are fetched here (not in a client useEffect)
// so the real branding/hero/copy is already in the first server-rendered
// HTML - a hard refresh no longer flashes the hardcoded defaults before
// swapping to what's actually configured in Site Settings.
export default async function Page() {
  const settings = await loadSettings();
  return <LandingHome initialSettings={settings} />;
}
