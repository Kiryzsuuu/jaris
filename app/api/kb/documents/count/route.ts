import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import KbDocument from "@/models/KbDocument";

// Document count only (no titles/content) - shown as the "RAG Aktif · N
// Dokumen" badge on the AI Assistant page. Gated by assistant:use rather
// than kb:manage, since any user who can chat should see this, not just
// knowledge-base admins.
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.ASSISTANT_USE);

    const count = await KbDocument.countDocuments({ isActive: true });
    return successResponse({ count });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
