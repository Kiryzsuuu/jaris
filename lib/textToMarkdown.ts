/**
 * Converts raw extracted PDF text into lightweight Markdown. This is a
 * heuristic cleanup pass, not a full document-structure parser: it strips
 * repeated whitespace/page-break noise that PDF text extraction leaves
 * behind, and normalizes obvious headers/bullets into Markdown syntax.
 *
 * Goal: smaller, cleaner chunks going into the RAG pipeline, so retrieval
 * sends less noisy text (and fewer tokens) to Groq per answer.
 */
export function pdfTextToMarkdown(rawText: string): string {
  const lines = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\f/g, "\n\n") // form-feed = page break in most PDF extractors
    .split("\n")
    .map((l) => l.trim());

  const output: string[] = [];
  let blankStreak = 0;

  for (const line of lines) {
    if (!line) {
      blankStreak++;
      if (blankStreak <= 1) output.push("");
      continue;
    }
    blankStreak = 0;

    if (isLikelyHeading(line)) {
      output.push(`## ${toTitleCase(line)}`);
      continue;
    }

    const bulletMatch = /^[-•*]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      output.push(`- ${bulletMatch[1]}`);
      continue;
    }

    output.push(line);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isLikelyHeading(line: string): boolean {
  if (line.length > 80 || line.length < 3) return false;
  if (/[.:;,]$/.test(line)) return false;
  const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
  const isNumberedSection = /^(bab|pasal|bagian|section)\s+[ivxlcdm\d]+/i.test(line);
  return isAllCaps || isNumberedSection;
}

function toTitleCase(line: string): string {
  if (line === line.toUpperCase()) {
    return line
      .toLowerCase()
      .split(" ")
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }
  return line;
}
