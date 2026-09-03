import { groqChatCompletion, groqVisionCompletion, GroqError } from "@/lib/groqClient";
import { CASE_CATEGORY_LABELS, type CaseCategory } from "@/lib/claimTypes";

export type AuditStep = {
  step: number;
  name: string;
  status: "ok" | "warning" | "skipped";
  detail: string;
};

export type AuditFlag = {
  severity: "info" | "warning" | "critical";
  message: string;
};

export type ClaimAuditResult = {
  steps: AuditStep[];
  documentFindings: { documentId: string; fileName: string; severity: string | null; description: string | null }[];
  flags: AuditFlag[];
  overallAssessment: string;
  recommendation: "lanjutkan" | "perlu_klarifikasi" | "tinjau_ulang";
  isSuggestionOnly: true;
};

// Document types an officer would reasonably expect on file per case
// category, used only to flag GAPS for the officer to check - never to
// block or auto-decide anything.
const EXPECTED_DOCS: Record<CaseCategory, string[]> = {
  meninggal_dunia: ["surat_keterangan_kecelakaan", "akta_kematian", "kartu_keluarga"],
  cacat_tetap: ["surat_keterangan_kecelakaan", "surat_keterangan_dokter_cacat_tetap"],
  perawatan: ["surat_keterangan_kecelakaan", "kwitansi_biaya_rawatan"],
  penguburan: ["surat_keterangan_kecelakaan", "kwitansi_biaya_penguburan"],
};

type ClaimInput = {
  caseCategory: CaseCategory;
  transportMode: string;
  accidentDescription: string;
  disabilityPercentage: number | null;
  claimedTreatmentCost: number | null;
  estimatedAmount: number | null;
  documents: { id: string; type: string; fileName: string; mimeType: string; fileBase64: string }[];
};

/**
 * Multi-step claim-audit agent: (1) a deterministic document-completeness
 * check, (2) a Groq vision pass per photo document, (3) a final Groq
 * synthesis step that reasons over the prior steps' structured output.
 *
 * This never recalculates or overrides the santunan amount - that stays a
 * fixed government tariff-table lookup done by lib/tariffEngine.ts. The
 * agent only flags things for a human reviewer to check (PRD principle:
 * AI membantu, manusia memutuskan).
 */
export async function runClaimAuditAgent(claim: ClaimInput): Promise<ClaimAuditResult> {
  const steps: AuditStep[] = [];

  // Step 1: deterministic document-completeness check.
  const expected = EXPECTED_DOCS[claim.caseCategory] ?? [];
  const presentTypes = new Set(claim.documents.map((d) => d.type));
  const missing = expected.filter((t) => !presentTypes.has(t));
  steps.push({
    step: 1,
    name: "Pemeriksaan kelengkapan dokumen",
    status: missing.length === 0 ? "ok" : "warning",
    detail:
      missing.length === 0
        ? "Semua dokumen inti untuk kategori ini tersedia."
        : `Dokumen yang biasanya diperlukan namun belum ditemukan: ${missing.join(", ")}.`,
  });

  // Step 2: vision analysis per image document (bounded - at most 4 photos
  // per run to keep latency/cost predictable).
  const imageDocuments = claim.documents.filter((d) => d.mimeType.startsWith("image/")).slice(0, 4);
  const documentFindings: ClaimAuditResult["documentFindings"] = [];

  for (const doc of imageDocuments) {
    try {
      const raw = await groqVisionCompletion({
        imageBase64: doc.fileBase64,
        mimeType: doc.mimeType,
        jsonMode: true,
        prompt: [
          "Anda membantu petugas Jasa Raharja menilai foto pendukung klaim kecelakaan.",
          'Jawab HANYA dalam format JSON: {"severity": "ringan"|"sedang"|"berat", "confidence": <0-1>, "description": "<deskripsi singkat, Bahasa Indonesia>"}',
          "Ini hanya SARAN, bukan keputusan final.",
        ].join("\n"),
      });
      const parsed = JSON.parse(raw) as { severity?: string; confidence?: number; description?: string };
      documentFindings.push({
        documentId: doc.id,
        fileName: doc.fileName,
        severity: parsed.severity ?? null,
        description: parsed.description ?? null,
      });
    } catch {
      documentFindings.push({ documentId: doc.id, fileName: doc.fileName, severity: null, description: null });
    }
  }

  steps.push({
    step: 2,
    name: "Analisis foto pendukung (AI vision)",
    status: imageDocuments.length > 0 ? "ok" : "skipped",
    detail:
      imageDocuments.length > 0
        ? `${imageDocuments.length} foto dianalisis.`
        : "Tidak ada dokumen bertipe gambar untuk dianalisis.",
  });

  // Step 3: synthesis - reason over steps 1-2 plus claim data, produce
  // structured flags and a recommendation. Advisory only.
  const synthesisPrompt = [
    "Anda adalah asisten audit klaim untuk petugas Jasa Raharja. Tugas Anda HANYA memberi saran tinjauan, bukan menyetujui/menolak/menghitung ulang santunan.",
    `Kategori kasus: ${CASE_CATEGORY_LABELS[claim.caseCategory]}`,
    `Moda transportasi: ${claim.transportMode}`,
    `Deskripsi kejadian: ${claim.accidentDescription}`,
    claim.disabilityPercentage !== null ? `Persentase cacat yang diklaim: ${claim.disabilityPercentage}%` : null,
    claim.claimedTreatmentCost !== null ? `Biaya perawatan yang diklaim: Rp${claim.claimedTreatmentCost.toLocaleString("id-ID")}` : null,
    claim.estimatedAmount !== null
      ? `Estimasi santunan dari rules engine (tarif tetap, sudah final, JANGAN dihitung ulang): Rp${claim.estimatedAmount.toLocaleString("id-ID")}`
      : null,
    `Hasil pemeriksaan kelengkapan dokumen: ${steps[0].detail}`,
    documentFindings.length > 0
      ? `Hasil analisis foto: ${documentFindings
          .map((f) => `${f.fileName} - tingkat kerusakan ${f.severity ?? "tidak terdeteksi"}${f.description ? ` (${f.description})` : ""}`)
          .join("; ")}`
      : "Tidak ada foto untuk dianalisis.",
    "",
    'Jawab HANYA dalam format JSON: {"flags": [{"severity": "info"|"warning"|"critical", "message": "<Bahasa Indonesia>"}], "overallAssessment": "<ringkasan 2-3 kalimat, Bahasa Indonesia>", "recommendation": "lanjutkan"|"perlu_klarifikasi"|"tinjau_ulang"}',
    "flags boleh kosong jika tidak ada yang perlu diperhatikan. Jangan pernah menyarankan angka santunan baru - itu bukan wewenang Anda.",
  ]
    .filter(Boolean)
    .join("\n");

  let flags: AuditFlag[] = [];
  let overallAssessment = "AI Asisten tidak tersedia - lakukan tinjauan manual.";
  let recommendation: ClaimAuditResult["recommendation"] = "perlu_klarifikasi";

  try {
    const raw = await groqChatCompletion([{ role: "user", content: synthesisPrompt }], { jsonMode: true, temperature: 0.2 });
    const parsed = JSON.parse(raw) as {
      flags?: AuditFlag[];
      overallAssessment?: string;
      recommendation?: string;
    };
    flags = Array.isArray(parsed.flags) ? parsed.flags : [];
    overallAssessment = parsed.overallAssessment ?? overallAssessment;
    if (parsed.recommendation === "lanjutkan" || parsed.recommendation === "perlu_klarifikasi" || parsed.recommendation === "tinjau_ulang") {
      recommendation = parsed.recommendation;
    }
    steps.push({ step: 3, name: "Sintesis & rekomendasi (AI)", status: "ok", detail: "Analisis akhir berhasil dibuat." });
  } catch (error) {
    steps.push({
      step: 3,
      name: "Sintesis & rekomendasi (AI)",
      status: "warning",
      detail: error instanceof GroqError ? error.message : "Gagal membuat sintesis akhir.",
    });
  }

  return {
    steps,
    documentFindings,
    flags,
    overallAssessment,
    recommendation,
    isSuggestionOnly: true,
  };
}
