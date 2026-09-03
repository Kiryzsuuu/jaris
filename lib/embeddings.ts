/**
 * Embedding generation, kept behind a single function so the provider can be
 * swapped without touching ingest/retrieval code.
 *
 * Groq's API does not offer an embeddings endpoint, so this defaults to a
 * dependency-free local hashing embedding (deterministic, no external calls,
 * no extra API key required) - good enough to make RAG functional out of the
 * box. If EMBEDDING_API_KEY + EMBEDDING_API_URL are set, an OpenAI-compatible
 * embeddings endpoint is used instead for real semantic embeddings.
 *
 * IMPORTANT: changing provider/dimensions requires re-ingesting all documents
 * - vectors from different models are not comparable.
 */

const LOCAL_EMBEDDING_DIMENSIONS = 384;

export function getEmbeddingDimensions(): number {
  return process.env.EMBEDDING_API_URL
    ? Number(process.env.EMBEDDING_DIMENSIONS ?? 1536)
    : LOCAL_EMBEDDING_DIMENSIONS;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiUrl = process.env.EMBEDDING_API_URL;
  const apiKey = process.env.EMBEDDING_API_KEY;

  if (apiUrl && apiKey) {
    return generateEmbeddingViaProvider(text, apiUrl, apiKey);
  }

  return generateLocalHashEmbedding(text);
}

async function generateEmbeddingViaProvider(
  text: string,
  apiUrl: string,
  apiKey: string
): Promise<number[]> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding provider error: ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  const embedding = json?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding provider returned an unexpected response shape");
  }
  return embedding;
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Deterministic bag-of-words feature-hashing embedding. Not a real semantic
 * model, but stable, dependency-free, and adequate for keyword-driven
 * internal-document retrieval until a real embedding provider is configured.
 */
export function generateLocalHashEmbedding(text: string): number[] {
  const dims = LOCAL_EMBEDDING_DIMENSIONS;
  const vector = new Array(dims).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const bucket = hashToken(token) % dims;
    vector[bucket] += 1;
  }

  // Simple bigram signal helps disambiguate short queries.
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    const bucket = hashToken(bigram) % dims;
    vector[bucket] += 0.5;
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
