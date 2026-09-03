import { PDFParse } from "pdf-parse";
import { groqVisionCompletion, GroqError } from "@/lib/groqClient";

// Below this many characters per page, the text layer is treated as
// effectively empty (a scanned page still emits a handful of stray
// whitespace/control characters via pdf-parse).
const MIN_CHARS_PER_PAGE = 20;
// Hard cap so a huge scanned document doesn't trigger dozens of vision
// calls in one ingest request.
const MAX_OCR_PAGES = 25;

async function ocrPageImage(dataUrl: string, pageNumber: number): Promise<string> {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return "";
  const [, mimeType, base64] = match;

  try {
    const text = await groqVisionCompletion({
      imageBase64: base64,
      mimeType,
      prompt: [
        "Transkripsikan SELURUH teks yang terlihat pada gambar halaman dokumen ini apa adanya (OCR).",
        "Pertahankan urutan baris dan paragraf sebisa mungkin. Jangan meringkas, menerjemahkan, atau menambah komentar.",
        "Jika halaman kosong atau tidak ada teks yang bisa dibaca, jawab dengan string kosong.",
      ].join("\n"),
    });
    return text.trim();
  } catch (error) {
    if (error instanceof GroqError) {
      return `[OCR halaman ${pageNumber} gagal: ${error.message}]`;
    }
    throw error;
  }
}

/**
 * Extracts text from a PDF. Tries the embedded text layer first (fast, free,
 * exact); for pages where that comes back effectively empty - a scanned/
 * photographed document with no text layer - each such page is rendered to
 * an image and OCR'd via the same Groq vision model already used for damage
 * photos, since installing a native OCR engine (tesseract) on a server that
 * hosts several other clients' apps isn't worth the added ops risk when a
 * vision-LLM pass does the same job.
 */
export async function extractTextFromPdfBase64(pdfBase64: string): Promise<string> {
  const buffer = Buffer.from(pdfBase64, "base64");
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();

    const scannedPages = textResult.pages
      .filter((p) => p.text.trim().length < MIN_CHARS_PER_PAGE)
      .map((p) => p.num)
      .slice(0, MAX_OCR_PAGES);

    if (scannedPages.length === 0) {
      return textResult.text;
    }

    const screenshotResult = await parser.getScreenshot({
      partial: scannedPages,
      imageDataUrl: true,
      scale: 2,
    });

    const ocrByPage = new Map<number, string>();
    for (const page of screenshotResult.pages) {
      ocrByPage.set(page.pageNumber, await ocrPageImage(page.dataUrl, page.pageNumber));
    }

    const merged = textResult.pages
      .map((p) => {
        const ocrText = ocrByPage.get(p.num);
        const pageText = p.text.trim().length >= MIN_CHARS_PER_PAGE ? p.text : (ocrText ?? p.text);
        return pageText;
      })
      .join("\n\n");

    return merged;
  } finally {
    await parser.destroy();
  }
}
