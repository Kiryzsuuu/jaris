import KbEmbedding, { type IKbEmbedding } from "@/models/KbEmbedding";
import { cosineSimilarity } from "@/lib/embeddings";

export const KB_VECTOR_INDEX_NAME = "kb_vector_index";

export interface RetrievedChunk {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  chunkText: string;
  score: number;
}

/**
 * Retrieves the top-K most relevant chunks for a query embedding.
 *
 * Tries MongoDB Atlas Vector Search ($vectorSearch) first - this requires a
 * vector index named KB_VECTOR_INDEX_NAME to be created manually in the
 * Atlas dashboard (see README). If that index does not exist yet (e.g. fresh
 * setup, or running against a non-Atlas / local MongoDB), it falls back to
 * brute-force cosine similarity over kb_embeddings in application code, so
 * the assistant still works before the manual Atlas step is done - just
 * without the performance/scale benefits of a real vector index.
 */
export async function retrieveRelevantChunks(
  queryEmbedding: number[],
  topK = 5
): Promise<RetrievedChunk[]> {
  try {
    return await retrieveViaAtlasVectorSearch(queryEmbedding, topK);
  } catch {
    return retrieveViaBruteForce(queryEmbedding, topK);
  }
}

async function retrieveViaAtlasVectorSearch(
  queryEmbedding: number[],
  topK: number
): Promise<RetrievedChunk[]> {
  const results = await KbEmbedding.aggregate([
    {
      $vectorSearch: {
        index: KB_VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: Math.max(topK * 20, 100),
        limit: topK,
      },
    },
    {
      $project: {
        documentId: 1,
        documentTitle: 1,
        chunkIndex: 1,
        chunkText: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  if (!Array.isArray(results) || results.length === 0) {
    // Could mean "no matches" or "index doesn't exist" - either way, an
    // empty result from a real vector search is trustworthy, but if the
    // index is simply missing Mongo throws instead of returning []; we only
    // reach here on success, so treat empty as a genuine empty KB.
    return [];
  }

  return results.map((r) => ({
    documentId: r.documentId.toString(),
    documentTitle: r.documentTitle,
    chunkIndex: r.chunkIndex,
    chunkText: r.chunkText,
    score: r.score,
  }));
}

async function retrieveViaBruteForce(
  queryEmbedding: number[],
  topK: number
): Promise<RetrievedChunk[]> {
  const all = await KbEmbedding.find().lean<IKbEmbedding[]>();

  const scored = all.map((e) => ({
    documentId: e.documentId.toString(),
    documentTitle: e.documentTitle,
    chunkIndex: e.chunkIndex,
    chunkText: e.chunkText,
    score: cosineSimilarity(queryEmbedding, e.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
