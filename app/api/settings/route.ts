import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { getSiteSettings, serializeSiteSettings } from "@/lib/siteSettings";
import { recordAuditLog } from "@/lib/auditLog";

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

// Images (logo/favicon) must be submitted as base64 data URLs from the
// client - never as raw file uploads or external URLs.
const MAX_IMAGE_BASE64_LENGTH = 2_000_000; // ~1.5MB raw image

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
    if (typeof body.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.primaryColor)) {
      settings.primaryColor = body.primaryColor;
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

    await settings.save();
    const after = serializeSiteSettings(settings);

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "site_settings_updated",
      target: "site_settings",
      before: { ...before, logoDataUrl: before.logoDataUrl ? "(image)" : null },
      after: { ...after, logoDataUrl: after.logoDataUrl ? "(image)" : null },
    });

    return successResponse(after, "Pengaturan situs berhasil disimpan");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
