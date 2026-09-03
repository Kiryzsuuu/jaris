export interface TextChunk {
  index: number;
  text: string;
}

// Kept small on purpose: smaller chunks mean fewer tokens sent to Groq per
// RAG answer (each retrieved chunk becomes part of the prompt context).
const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 80;

/**
 * Pure text chunker - sliding window over normalized whitespace, preferring
 * to break on paragraph/sentence boundaries near the target size. No I/O,
 * so it is trivial to unit-test independently of the ingest pipeline.
 */
export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number }
): TextChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", end);
      const sentenceBreak = normalized.lastIndexOf(". ", end);
      const boundary = Math.max(paragraphBreak, sentenceBreak);
      if (boundary > start + chunkSize * 0.5) {
        end = boundary + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      chunks.push({ index, text: chunk });
      index += 1;
    }

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
