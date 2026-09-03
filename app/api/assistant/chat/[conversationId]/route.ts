import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import ChatHistory from "@/models/ChatHistory";

type Params = { params: Promise<{ conversationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.ASSISTANT_USE);
    const { conversationId } = await params;

    const messages = await ChatHistory.find({
      conversationId,
      userId: session.sub,
    }).sort({ createdAt: 1 });

    const data = messages.map((m) => ({
      id: m._id.toString(),
      role: m.role,
      content: m.content,
      sources: m.sources.map((s) => ({
        documentId: s.documentId.toString(),
        documentTitle: s.documentTitle,
        chunkIndex: s.chunkIndex,
        score: s.score,
      })),
      isGrounded: m.isGrounded,
      createdAt: m.get("createdAt"),
    }));

    return successResponse(data, "Riwayat percakapan");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
