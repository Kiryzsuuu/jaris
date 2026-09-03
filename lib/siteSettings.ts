import SiteSettings from "@/models/SiteSettings";

export async function getSiteSettings() {
  const settings = await SiteSettings.findOneAndUpdate(
    { singleton: "main" },
    { $setOnInsert: { singleton: "main" } },
    { upsert: true, new: true }
  );
  return settings;
}

export function serializeSiteSettings(settings: Awaited<ReturnType<typeof getSiteSettings>>) {
  return {
    siteName: settings.siteName,
    tagline: settings.tagline,
    logoDataUrl:
      settings.logoBase64 && settings.logoMimeType
        ? `data:${settings.logoMimeType};base64,${settings.logoBase64}`
        : null,
    faviconDataUrl:
      settings.faviconBase64 && settings.faviconMimeType
        ? `data:${settings.faviconMimeType};base64,${settings.faviconBase64}`
        : null,
    heroImageDataUrl:
      settings.heroImageBase64 && settings.heroImageMimeType
        ? `data:${settings.heroImageMimeType};base64,${settings.heroImageBase64}`
        : null,
    sectionImageDataUrl:
      settings.sectionImageBase64 && settings.sectionImageMimeType
        ? `data:${settings.sectionImageMimeType};base64,${settings.sectionImageBase64}`
        : null,
    heroHeadline: settings.heroHeadline,
    heroSubheadline: settings.heroSubheadline,
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    aiColor: settings.aiColor,
    highlightColor: settings.highlightColor,
    accentColor: settings.accentColor,
    backgroundColor: settings.backgroundColor,
    sidebarColor: settings.sidebarColor,
    footerText: settings.footerText,
    cardImages: Object.fromEntries(
      Array.from(settings.cardImages ?? new Map(), ([slug, img]) => [slug, `data:${img.mimeType};base64,${img.base64}`])
    ),
    updatedAt: settings.get("updatedAt"),
  };
}
