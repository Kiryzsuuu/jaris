import KbDocument, { type KbSourceType } from "@/models/KbDocument";
import KbEmbedding from "@/models/KbEmbedding";
import { chunkText } from "@/lib/chunking";
import { generateEmbedding, getEmbeddingDimensions } from "@/lib/embeddings";

export class KbIngestError extends Error {}

export async function ingestDocument(params: {
  title: string;
  category: string;
  sourceType: KbSourceType;
  rawText: string;
  uploadedBy: string;
}) {
  const title = params.title?.trim();
  const category = params.category?.trim();
  const rawText = params.rawText?.trim();

  if (!title || !category || !rawText) {
    throw new KbIngestError("title, category, dan rawText wajib diisi");
  }

  const chunks = chunkText(rawText);
  if (chunks.length === 0) {
    throw new KbIngestError("Dokumen tidak menghasilkan konten yang bisa di-chunk");
  }

  const document = await KbDocument.create({
    title,
    category,
    sourceType: params.sourceType,
    rawText,
    chunkCount: chunks.length,
    isActive: true,
    uploadedBy: params.uploadedBy,
  });

  const dimensions = getEmbeddingDimensions();
  const embeddingDocs = [];
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.text);
    embeddingDocs.push({
      documentId: document._id,
      documentTitle: document.title,
      chunkIndex: chunk.index,
      chunkText: chunk.text,
      embedding,
      embeddingDimensions: dimensions,
    });
  }

  await KbEmbedding.insertMany(embeddingDocs);

  return { document, chunkCount: chunks.length };
}

export async function deleteDocument(documentId: string) {
  await KbEmbedding.deleteMany({ documentId });
  await KbDocument.findByIdAndDelete(documentId);
}
