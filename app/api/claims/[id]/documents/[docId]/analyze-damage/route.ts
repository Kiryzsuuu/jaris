import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { canAccessClaim } from "@/lib/claimAccess";
import { groqVisionCompletion, GroqError } from "@/lib/groqClient";
import Claim from "@/models/Claim";

type Params = { params: Promise<{ id: string; docId: string }> };

const SEVERITY_LEVELS = ["ringan", "sedang", "berat"] as const;

// AI gives a SUGGESTION only (severity estimate + description) - it is never
// written to the claim automatically. The officer reviewing the claim reads
// it as advisory context, same principle as case-classification suggestions
// (PRD §3.1: AI membantu, manusia memutuskan).
export async function POST(request: NextRequest, { params }: Params) {
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
    if (!doc.mimeType.startsWith("image/")) {
      return errorResponse("Analisis kerusakan hanya berlaku untuk dokumen bertipe gambar", 400);
    }

    const prompt = [
      "Anda membantu petugas Jasa Raharja menilai foto kerusakan kendaraan/lokasi kecelakaan.",
      `Tingkat keparahan yang tersedia (gunakan HANYA salah satu key berikut): ${SEVERITY_LEVELS.join(", ")}.`,
      'Jawab HANYA dalam format JSON: {"severity": "<salah satu key di atas>", "confidence": <angka 0-1>, "description": "<deskripsi singkat kerusakan yang terlihat, dalam Bahasa Indonesia>"}',
      "Jika gambar tidak menunjukkan kerusakan yang jelas atau bukan foto kecelakaan, tetap isi field dengan estimasi terbaik dan turunkan confidence.",
      "Ini hanya SARAN - keputusan akhir tetap di tangan petugas yang meninjau klaim.",
    ].join("\n");

    let raw: string;
    try {
      raw = await groqVisionCompletion({
        imageBase64: doc.fileBase64,
        mimeType: doc.mimeType,
        prompt,
        jsonMode: true,
      });
    } catch (error) {
      if (error instanceof GroqError) {
        return errorResponse(`AI Asisten tidak tersedia: ${error.message}`, 502);
      }
      throw error;
    }

    let parsed: { severity?: string; confidence?: number; description?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return errorResponse("AI mengembalikan format yang tidak bisa diproses", 502);
    }

    const isValidSeverity = SEVERITY_LEVELS.includes(
      parsed.severity as (typeof SEVERITY_LEVELS)[number]
    );

    return successResponse(
      {
        severity: isValidSeverity ? parsed.severity : null,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
        description: parsed.description ?? null,
        isSuggestionOnly: true,
      },
      isValidSeverity
        ? "Analisis foto selesai - tetap wajib ditinjau petugas"
        : "AI tidak yakin dengan hasil analisis - tinjau foto secara manual"
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
