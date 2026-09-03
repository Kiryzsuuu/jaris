import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteDocument } from "@/lib/kbIngest";
import { recordAuditLog } from "@/lib/auditLog";
import KbDocument from "@/models/KbDocument";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.KB_MANAGE);
    const { id } = await params;

    const doc = await KbDocument.findById(id);
    if (!doc) return errorResponse("Dokumen tidak ditemukan", 404);

    await deleteDocument(id);

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "kb_document_deleted",
      target: "kb_document",
      targetId: doc._id,
      before: { title: doc.title, category: doc.category },
    });

    return successResponse(null, "Dokumen berhasil dihapus dari knowledge base");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
