import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { getSiteSettings, serializeSiteSettings } from "@/lib/siteSettings";
import { recordAuditLog } from "@/lib/auditLog";
import { ALL_LANDING_CARDS } from "@/lib/landingContent";

// Public on purpose: the login page and every layout need site name/logo
// before a session exists. Nothing sensitive is stored here.
export async function GET() {
  try {
    await connectToDatabase();
    const settings = await getSiteSettings();
    return successResponse(serializeSiteSettings(settings), "Pengaturan situs");
  } catch (error) {
    return handleApiError(error);
  }
}

// Images (logo/favicon/hero) must be submitted as base64 data URLs from the
// client - never as raw file uploads or external URLs.
const MAX_IMAGE_BASE64_LENGTH = 2_000_000; // ~1.5MB raw image
const MAX_HERO_IMAGE_BASE64_LENGTH = 6_000_000; // ~4.5MB raw image
// Hero images are now an array (slideshow) stored in one document, so each
// slide is capped at the regular image size and the count is capped too -
// otherwise a handful of max-size slides could approach MongoDB's 16MB
// per-document limit.
const MAX_HERO_IMAGES = 6;

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.SETTINGS_MANAGE);

    const body = await request.json();
    const settings = await getSiteSettings();
    const before = serializeSiteSettings(settings);

    if (typeof body.siteName === "string" && body.siteName.trim()) {
      settings.siteName = body.siteName.trim();
    }
    if (typeof body.tagline === "string") {
      settings.tagline = body.tagline.trim();
    }
    if (typeof body.footerText === "string") {
      settings.footerText = body.footerText.trim();
    }
    const HEX = /^#[0-9a-fA-F]{6}$/;
    const colorFields = [
      "primaryColor",
      "secondaryColor",
      "aiColor",
      "highlightColor",
      "accentColor",
      "backgroundColor",
      "sidebarColor",
    ] as const;
    for (const field of colorFields) {
      if (typeof body[field] === "string" && HEX.test(body[field])) {
        settings[field] = body[field];
      }
    }
    if (typeof body.heroHeadline === "string" && body.heroHeadline.trim()) {
      settings.heroHeadline = body.heroHeadline.trim();
    }
    if (typeof body.heroSubheadline === "string" && body.heroSubheadline.trim()) {
      settings.heroSubheadline = body.heroSubheadline.trim();
    }

    if (typeof body.logoDataUrl === "string") {
      if (body.logoDataUrl === "") {
        settings.logoBase64 = null;
        settings.logoMimeType = null;
      } else {
        const parsed = parseDataUrl(body.logoDataUrl);
        if (!parsed) return errorResponse("logoDataUrl harus data URL gambar base64 yang valid", 400);
        if (parsed.base64.length > MAX_IMAGE_BASE64_LENGTH) {
          return errorResponse("Ukuran logo terlalu besar (maksimum ~1.5MB)", 400);
        }
        settings.logoBase64 = parsed.base64;
        settings.logoMimeType = parsed.mimeType;
      }
    }

    if (typeof body.faviconDataUrl === "string") {
      if (body.faviconDataUrl === "") {
        settings.faviconBase64 = null;
        settings.faviconMimeType = null;
      } else {
        const parsed = parseDataUrl(body.faviconDataUrl);
        if (!parsed) return errorResponse("faviconDataUrl harus data URL gambar base64 yang valid", 400);
        if (parsed.base64.length > MAX_IMAGE_BASE64_LENGTH) {
          return errorResponse("Ukuran favicon terlalu besar (maksimum ~1.5MB)", 400);
        }
        settings.faviconBase64 = parsed.base64;
        settings.faviconMimeType = parsed.mimeType;
      }
    }

    if (Array.isArray(body.heroImageDataUrls)) {
      if (body.heroImageDataUrls.length > MAX_HERO_IMAGES) {
        return errorResponse(`Maksimum ${MAX_HERO_IMAGES} gambar hero`, 400);
      }
      const parsedImages: { base64: string; mimeType: string }[] = [];
      for (const dataUrl of body.heroImageDataUrls) {
        if (typeof dataUrl !== "string") return errorResponse("heroImageDataUrls harus berisi data URL gambar", 400);
        const parsed = parseDataUrl(dataUrl);
        if (!parsed) return errorResponse("Setiap gambar hero harus data URL gambar base64 yang valid", 400);
        if (parsed.base64.length > MAX_IMAGE_BASE64_LENGTH) {
          return errorResponse("Ukuran salah satu gambar hero terlalu besar (maksimum ~1.5MB per gambar)", 400);
        }
        parsedImages.push(parsed);
      }
      settings.heroImages = parsedImages;
    }

    if (typeof body.sectionImageDataUrl === "string") {
      if (body.sectionImageDataUrl === "") {
        settings.sectionImageBase64 = null;
        settings.sectionImageMimeType = null;
      } else {
        const parsed = parseDataUrl(body.sectionImageDataUrl);
        if (!parsed) return errorResponse("sectionImageDataUrl harus data URL gambar base64 yang valid", 400);
        if (parsed.base64.length > MAX_HERO_IMAGE_BASE64_LENGTH) {
          return errorResponse("Ukuran gambar terlalu besar (maksimum ~4.5MB)", 400);
        }
        settings.sectionImageBase64 = parsed.base64;
        settings.sectionImageMimeType = parsed.mimeType;
      }
    }

    if (typeof body.loginImageDataUrl === "string") {
      if (body.loginImageDataUrl === "") {
        settings.loginImageBase64 = null;
        settings.loginImageMimeType = null;
      } else {
        const parsed = parseDataUrl(body.loginImageDataUrl);
        if (!parsed) return errorResponse("loginImageDataUrl harus data URL gambar base64 yang valid", 400);
        if (parsed.base64.length > MAX_HERO_IMAGE_BASE64_LENGTH) {
          return errorResponse("Ukuran gambar login terlalu besar (maksimum ~4.5MB)", 400);
        }
        settings.loginImageBase64 = parsed.base64;
        settings.loginImageMimeType = parsed.mimeType;
      }
    }

    if (body.cardImages && typeof body.cardImages === "object") {
      const validSlugs = new Set(ALL_LANDING_CARDS.map((c) => c.slug));
      for (const [slug, dataUrl] of Object.entries(body.cardImages as Record<string, unknown>)) {
        if (!validSlugs.has(slug)) continue;
        if (dataUrl === "") {
          settings.cardImages.delete(slug);
          continue;
        }
        if (typeof dataUrl !== "string") continue;
        const parsed = parseDataUrl(dataUrl);
        if (!parsed) return errorResponse(`Gambar untuk kartu '${slug}' harus data URL gambar base64 yang valid`, 400);
        if (parsed.base64.length > MAX_IMAGE_BASE64_LENGTH) {
          return errorResponse(`Ukuran gambar untuk kartu '${slug}' terlalu besar (maksimum ~1.5MB)`, 400);
        }
        settings.cardImages.set(slug, parsed);
      }
      settings.markModified("cardImages");
    }

    await settings.save();
    const after = serializeSiteSettings(settings);

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "site_settings_updated",
      target: "site_settings",
      before: {
        ...before,
        logoDataUrl: before.logoDataUrl ? "(image)" : null,
        heroImageDataUrls: `(${before.heroImageDataUrls.length} image(s))`,
      },
      after: {
        ...after,
        logoDataUrl: after.logoDataUrl ? "(image)" : null,
        heroImageDataUrls: `(${after.heroImageDataUrls.length} image(s))`,
      },
    });

    return successResponse(after, "Pengaturan situs berhasil disimpan");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
