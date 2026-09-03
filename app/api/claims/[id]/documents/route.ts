import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { recordAuditLog } from "@/lib/auditLog";
import Claim from "@/models/Claim";

type Params = { params: Promise<{ id: string }> };

// Documents are stored as base64 embedded in the claim document (no external
// object storage configured in this phase). Cap size to keep documents small.
const MAX_BASE64_LENGTH = 5_000_000; // ~3.7MB raw file

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_CREATE);
    const { id } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);
    if (claim.reporterId.toString() !== session.sub) {
      return errorResponse("Akses ditolak: bukan klaim milik Anda", 403);
    }
    if (!["draft", "submitted"].includes(claim.status)) {
      return errorResponse(
        `Dokumen hanya bisa diunggah selagi status draft/submitted (status saat ini: ${claim.status})`,
        409
      );
    }

    const body = await request.json();
    const { type, fileName, mimeType, fileBase64 } = body;

    if (!type || !fileName || !mimeType || !fileBase64) {
      return errorResponse("type, fileName, mimeType, fileBase64 wajib diisi", 400);
    }
    if (typeof fileBase64 !== "string" || fileBase64.length > MAX_BASE64_LENGTH) {
      return errorResponse("Ukuran file terlalu besar (maksimum ~3.7MB)", 400);
    }

    claim.documents.push({
      type,
      fileName,
      mimeType,
      fileBase64,
      uploadedBy: new Types.ObjectId(session.sub),
      uploadedAt: new Date(),
    });
    await claim.save();

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "claim_document_uploaded",
      target: "claim",
      targetId: claim._id,
      after: { type, fileName },
    });

    return successResponse(
      {
        documents: claim.documents.map((d) => ({
          id: d._id?.toString(),
          type: d.type,
          fileName: d.fileName,
          mimeType: d.mimeType,
          uploadedAt: d.uploadedAt,
        })),
      },
      "Dokumen berhasil diunggah",
      201
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
