import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { CASE_CATEGORIES, CASE_CATEGORY_LABELS } from "@/lib/claimTypes";
import { groqChatCompletion, GroqError } from "@/lib/groqClient";

// AI gives a SUGGESTION only - the officer filling the claim form must
// confirm/override the final category themselves (PRD §3.1: AI membantu,
// manusia memutuskan). Nothing here is written to the claim automatically.
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.CLAIM_CREATE);

    const body = await request.json();
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!description) {
      return errorResponse("description wajib diisi", 400);
    }

    const categoryList = CASE_CATEGORIES.map(
      (c) => `- ${c}: ${CASE_CATEGORY_LABELS[c]}`
    ).join("\n");

    const systemPrompt = [
      "Anda membantu petugas lapangan Jasa Raharja mengklasifikasikan jenis kasus kecelakaan dari deskripsi teks.",
      "Kategori yang tersedia (gunakan HANYA salah satu key berikut, persis seperti tertulis):",
      categoryList,
      "",
      'Jawab HANYA dalam format JSON: {"category": "<salah satu key di atas>", "confidence": <angka 0-1>, "reasoning": "<alasan singkat dalam Bahasa Indonesia>"}',
      "Ini hanya SARAN - keputusan akhir tetap di tangan petugas.",
    ].join("\n");

    let raw: string;
    try {
      raw = await groqChatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: description },
        ],
        { temperature: 0, jsonMode: true }
      );
    } catch (error) {
      if (error instanceof GroqError) {
        return errorResponse(`AI Asisten tidak tersedia: ${error.message}`, 502);
      }
      throw error;
    }

    let parsed: { category?: string; confidence?: number; reasoning?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return errorResponse("AI mengembalikan format yang tidak bisa diproses", 502);
    }

    const isValidCategory = CASE_CATEGORIES.includes(
      parsed.category as (typeof CASE_CATEGORIES)[number]
    );

    return successResponse(
      {
        suggestedCategory: isValidCategory ? parsed.category : null,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
        reasoning: parsed.reasoning ?? null,
        isSuggestionOnly: true,
      },
      isValidCategory
        ? "Saran klasifikasi berhasil dibuat - tetap wajib dikonfirmasi petugas"
        : "AI tidak yakin dengan kategori - silakan pilih manual"
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
