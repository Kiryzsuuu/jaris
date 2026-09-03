import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { generateEmbedding } from "@/lib/embeddings";
import { retrieveRelevantChunks } from "@/lib/kbRetrieval";
import { groqChatCompletion } from "@/lib/groqClient";
import ChatHistory from "@/models/ChatHistory";

// Guardrail: below this similarity, we do not trust the retrieved chunks
// enough to let the LLM answer from them - we say "not found" instead of
// risking a hallucinated answer (PRD §3.3).
const MIN_RELEVANCE_SCORE = Number(process.env.RAG_MIN_SCORE ?? 0.15);
// Kept small on purpose to keep the Groq prompt light (fewer chunks x
// smaller chunk size from lib/chunking.ts = fewer tokens per request).
const TOP_K = 3;

const NOT_FOUND_ANSWER =
  "Maaf, saya tidak menemukan informasi yang relevan mengenai pertanyaan ini di knowledge base internal JARIS. Silakan hubungi unit terkait secara langsung, atau minta admin menambahkan dokumen referensinya ke knowledge base.";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.ASSISTANT_USE);

    const conversations = await ChatHistory.aggregate([
      { $match: { userId: new Types.ObjectId(session.sub) } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$content" },
          lastRole: { $first: "$role" },
          updatedAt: { $first: "$createdAt" },
        },
      },
      { $sort: { updatedAt: -1 } },
      { $limit: 50 },
    ]);

    const data = conversations.map((c) => ({
      conversationId: c._id,
      lastMessage: c.lastMessage,
      lastRole: c.lastRole,
      updatedAt: c.updatedAt,
    }));

    return successResponse(data, "Daftar percakapan");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.ASSISTANT_USE);

    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const conversationId = typeof body.conversationId === "string" && body.conversationId
      ? body.conversationId
      : randomUUID();

    if (!message) {
      return errorResponse("message wajib diisi", 400);
    }

    await ChatHistory.create({
      conversationId,
      userId: session.sub,
      role: "user",
      content: message,
      sources: [],
      isGrounded: true,
    });

    const queryEmbedding = await generateEmbedding(message);
    const retrieved = await retrieveRelevantChunks(queryEmbedding, TOP_K);
    const relevant = retrieved.filter((r) => r.score >= MIN_RELEVANCE_SCORE);

    if (relevant.length === 0) {
      await ChatHistory.create({
        conversationId,
        userId: session.sub,
        role: "assistant",
        content: NOT_FOUND_ANSWER,
        sources: [],
        isGrounded: false,
      });

      return successResponse(
        { conversationId, answer: NOT_FOUND_ANSWER, sources: [], grounded: false },
        "Tidak ditemukan dokumen relevan di knowledge base"
      );
    }

    const contextBlock = relevant
      .map(
        (r, i) =>
          `[Sumber ${i + 1}: ${r.documentTitle}, bagian #${r.chunkIndex}]\n${r.chunkText}`
      )
      .join("\n\n---\n\n");

    const systemPrompt = [
      "Anda adalah AI Asisten Internal JARIS untuk pegawai PT Jasa Raharja (Persero).",
      "Jawab HANYA berdasarkan potongan dokumen konteks yang diberikan di bawah ini.",
      "Jangan menggunakan pengetahuan umum di luar konteks, dan jangan mengarang angka atau ketentuan.",
      "Jika konteks tidak cukup untuk menjawab, katakan dengan jelas bahwa informasi tidak ditemukan di knowledge base.",
      "Jawab dalam Bahasa Indonesia yang ringkas dan jelas. Sebutkan sumber yang relevan (mis. 'Sumber 1') saat menyatakan fakta.",
      "",
      "=== KONTEKS DOKUMEN ===",
      contextBlock,
    ].join("\n");

    let answer: string;
    try {
      answer = await groqChatCompletion([
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ]);
    } catch (error) {
      return handleApiError(error);
    }

    const sources = relevant.map((r) => ({
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      chunkIndex: r.chunkIndex,
      score: r.score,
    }));

    await ChatHistory.create({
      conversationId,
      userId: session.sub,
      role: "assistant",
      content: answer,
      sources,
      isGrounded: true,
    });

    return successResponse(
      { conversationId, answer, sources, grounded: true },
      "Jawaban berhasil dibuat"
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
