import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";

export async function GET() {
  try {
    await connectToDatabase();

    const readyStateMap: Record<number, string> = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    return successResponse(
      {
        server: "ok",
        database: {
          status: readyStateMap[mongoose.connection.readyState] ?? "unknown",
          name: mongoose.connection.name ?? null,
        },
        timestamp: new Date().toISOString(),
      },
      "JARIS API is healthy"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
