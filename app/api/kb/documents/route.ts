import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { ingestDocument, KbIngestError } from "@/lib/kbIngest";
import { extractTextFromPdfBase64 } from "@/lib/pdfExtract";
import { pdfTextToMarkdown } from "@/lib/textToMarkdown";
import { recordAuditLog } from "@/lib/auditLog";
import KbDocument from "@/models/KbDocument";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.KB_MANAGE);

    const docs = await KbDocument.find().sort({ createdAt: -1 });
    const data = docs.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      category: d.category,
      sourceType: d.sourceType,
      chunkCount: d.chunkCount,
      isActive: d.isActive,
      createdAt: d.get("createdAt"),
    }));

    return successResponse(data, "Daftar dokumen knowledge base");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

// Admin-only ingest pipeline: accepts raw text/markdown, or a base64-encoded
// PDF (sourceType "pdf") which is text-extracted before chunking.
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.KB_MANAGE);

    const body = await request.json();
    const { title, category, sourceType } = body;

    if (!["text", "markdown", "pdf"].includes(sourceType)) {
      return errorResponse("sourceType harus salah satu dari: text, markdown, pdf", 400);
    }

    let rawText: string;
    let effectiveSourceType = sourceType;
    if (sourceType === "pdf") {
      if (!body.fileBase64) {
        return errorResponse("fileBase64 wajib diisi untuk sourceType 'pdf'", 400);
      }
      // PDF text extraction is noisy (page breaks, repeated headers/footers).
      // Converting it to Markdown right away keeps chunks - and therefore
      // the context sent to Groq per RAG answer - smaller and cleaner.
      const extractedText = await extractTextFromPdfBase64(body.fileBase64);
      rawText = pdfTextToMarkdown(extractedText);
      effectiveSourceType = "markdown";
    } else {
      if (!body.content) {
        return errorResponse("content wajib diisi untuk sourceType 'text'/'markdown'", 400);
      }
      rawText = body.content;
    }

    const { document, chunkCount } = await ingestDocument({
      title,
      category,
      sourceType: effectiveSourceType,
      rawText,
      uploadedBy: session.sub,
    });

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "kb_document_ingested",
      target: "kb_document",
      targetId: document._id,
      after: { title: document.title, category: document.category, chunkCount },
    });

    return successResponse(
      { id: document._id.toString(), title: document.title, chunkCount },
      "Dokumen berhasil di-ingest ke knowledge base",
      201
    );
  } catch (error) {
    if (error instanceof KbIngestError) {
      return errorResponse(error.message, 400);
    }
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
