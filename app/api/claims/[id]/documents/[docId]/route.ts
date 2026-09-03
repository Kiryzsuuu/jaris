import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { canAccessClaim } from "@/lib/claimAccess";
import Claim from "@/models/Claim";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_VIEW);
    const { id, docId } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);
    if (!canAccessClaim(session, claim.reporterId.toString())) {
      return errorResponse("Akses ditolak: bukan klaim milik Anda", 403);
    }

    const doc = claim.documents.find((d) => d._id?.toString() === docId);
    if (!doc) return errorResponse("Dokumen tidak ditemukan", 404);

    return successResponse({
      id: doc._id?.toString(),
      type: doc.type,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileBase64: doc.fileBase64,
      uploadedAt: doc.uploadedAt,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
