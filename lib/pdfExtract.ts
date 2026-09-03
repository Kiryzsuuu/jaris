import { PDFParse } from "pdf-parse";

export async function extractTextFromPdfBase64(pdfBase64: string): Promise<string> {
  const buffer = Buffer.from(pdfBase64, "base64");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
