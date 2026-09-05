import { groqChatCompletion, GroqError } from "@/lib/groqClient";
import { CASE_CATEGORY_LABELS, type CaseCategory } from "@/lib/claimTypes";
import Claim from "@/models/Claim";
import Claimant from "@/models/Claimant";

export type FraudSignal =
  | "over_charge"
  | "duplicate_claimant"
  | "shared_bank_account"
  | "insufficient_documentation"
  | "unusually_fast_approval";

export type SignalContribution = {
  signal: FraudSignal;
  label: string;
  points: number;
  detail: string;
};

export type FraudFinding = {
  claimId: string;
  claimNumber: string;
  claimantName: string;
  caseCategory: CaseCategory;
  signals: FraudSignal[];
  signalBreakdown: SignalContribution[];
  riskScore: number; // 0-100, deterministic composite score
  riskTier: "high" | "medium" | "low";
  detail: string; // deterministic explanation of why it was flagged
  aiNarrative: string | null; // LLM-written summary, filled in for the top findings only
  aiFinding: string | null; // "Temuan Utama" block, split from aiNarrative when available
  aiRecommendation: string | null; // "Rekomendasi" block
};

export type FraudScanResult = {
  scannedCount: number;
  findings: FraudFinding[];
  counts: { high: number; medium: number; low: number; safe: number; total: number };
  generatedAt: string;
  isSuggestionOnly: true;
};

export const SIGNAL_LABELS: Record<FraudSignal, string> = {
  over_charge: "Biaya perawatan jauh di atas rata-rata kategori (potensi over charge/over treatment)",
  duplicate_claimant: "NIK penerima santunan muncul di lebih dari satu klaim (potensi over claim)",
  shared_bank_account: "Nomor rekening yang sama dipakai oleh penerima santunan berbeda",
  insufficient_documentation: "Nilai klaim tinggi namun dokumen pendukung minim",
  unusually_fast_approval: "Waktu verifikasi-ke-persetujuan jauh lebih cepat dari rata-rata (potensi kurang teliti)",
};

const SIGNAL_SHORT_LABELS: Record<FraudSignal, string> = {
  over_charge: "Z-Score Tinggi",
  duplicate_claimant: "NIK Ganda",
  shared_bank_account: "Rekening Bersama",
  insufficient_documentation: "Dokumen Minim",
  unusually_fast_approval: "Persetujuan Cepat",
};

function riskTier(score: number): FraudFinding["riskTier"] {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function mean(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / (values.length || 1);
}

function stdDev(values: number[], avg: number) {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Statistical anomaly scan over claims data, aligned with the "AI-based
 * fraud detection (over claim, over charge, over treatment)" research topic.
 * This is deterministic statistics (z-scores, duplicate detection), not a
 * trained classifier - JARIS has no labeled fraud dataset to train one on.
 * An LLM writes the human-readable narrative for the highest-risk findings
 * only, so this stays fast and cheap to run over the whole claim set.
 * Pass `withNarrative: false` (e.g. for a sidebar badge count) to skip the
 * Groq call entirely.
 *
 * "Over stayed" (inflated hospital length-of-stay) cannot be detected from
 * current data - the Claim schema has no length-of-stay field. Flagging
 * that would mean fabricating a signal, so it's intentionally left out.
 */
export async function runFraudDetectionScan(
  limit = 10,
  options: { withNarrative?: boolean } = {}
): Promise<FraudScanResult> {
  const withNarrative = options.withNarrative ?? true;

  const claims = await Claim.find({ status: { $ne: "draft" }, fraudDismissedAt: null })
    .select("claimNumber claimantId caseCategory claimedTreatmentCost documents verification approval submittedAt")
    .lean();

  const claimantIds = [...new Set(claims.map((c) => c.claimantId.toString()))];
  const claimants = await Claimant.find({ _id: { $in: claimantIds } })
    .select("fullName nik bankAccountNumber")
    .lean();
  const claimantById = new Map(claimants.map((c) => [c._id.toString(), c]));

  // Signal 1: treatment-cost z-score per category (over charge / over treatment).
  const costsByCategory = new Map<string, number[]>();
  for (const c of claims) {
    if (c.caseCategory === "perawatan" && typeof c.claimedTreatmentCost === "number") {
      const arr = costsByCategory.get(c.caseCategory) ?? [];
      arr.push(c.claimedTreatmentCost);
      costsByCategory.set(c.caseCategory, arr);
    }
  }
  const costStats = new Map<string, { avg: number; sd: number }>();
  for (const [cat, values] of costsByCategory) {
    const avg = mean(values);
    costStats.set(cat, { avg, sd: stdDev(values, avg) });
  }

  // Signal 2: duplicate claimant NIK across multiple claims (over claim).
  const nikCounts = new Map<string, number>();
  for (const c of claims) {
    const claimant = claimantById.get(c.claimantId.toString());
    if (!claimant) continue;
    nikCounts.set(claimant.nik, (nikCounts.get(claimant.nik) ?? 0) + 1);
  }

  // Signal 3: shared bank account across different claimants.
  const accountToClaimants = new Map<string, Set<string>>();
  for (const claimant of claimants) {
    if (!claimant.bankAccountNumber) continue;
    const set = accountToClaimants.get(claimant.bankAccountNumber) ?? new Set();
    set.add(claimant._id.toString());
    accountToClaimants.set(claimant.bankAccountNumber, set);
  }

  // Signal 4: verification-to-approval turnaround z-score (unusually fast).
  const turnaroundHours: number[] = [];
  for (const c of claims) {
    const v = c.verification as { verifiedAt?: Date } | null | undefined;
    const a = c.approval as { approvedAt?: Date } | null | undefined;
    if (v?.verifiedAt && a?.approvedAt) {
      const hours = (new Date(a.approvedAt).getTime() - new Date(v.verifiedAt).getTime()) / 3_600_000;
      if (hours >= 0) turnaroundHours.push(hours);
    }
  }
  const turnaroundAvg = mean(turnaroundHours);
  const turnaroundSd = stdDev(turnaroundHours, turnaroundAvg);

  const findings: FraudFinding[] = [];

  for (const c of claims) {
    const claimant = claimantById.get(c.claimantId.toString());
    if (!claimant) continue;

    const signals: FraudSignal[] = [];
    const breakdown: SignalContribution[] = [];
    const reasons: string[] = [];
    let riskScore = 0;

    if (c.caseCategory === "perawatan" && typeof c.claimedTreatmentCost === "number") {
      const stats = costStats.get(c.caseCategory);
      if (stats && stats.sd > 0) {
        const z = (c.claimedTreatmentCost - stats.avg) / stats.sd;
        if (z > 2) {
          const points = Math.round(Math.min(40, z * 10));
          signals.push("over_charge");
          const detail = `biaya Rp${c.claimedTreatmentCost.toLocaleString("id-ID")} (z-score ${z.toFixed(1)})`;
          reasons.push(detail);
          breakdown.push({ signal: "over_charge", label: `Biaya ${z.toFixed(1)}σ di atas rata-rata`, points, detail });
          riskScore += points;
        }
      }
    }

    const nikCount = nikCounts.get(claimant.nik) ?? 1;
    if (nikCount > 1) {
      const points = Math.round(Math.min(35, nikCount * 12));
      signals.push("duplicate_claimant");
      const detail = `NIK ini muncul di ${nikCount} klaim`;
      reasons.push(detail);
      breakdown.push({ signal: "duplicate_claimant", label: "NIK ganda ditemukan", points, detail });
      riskScore += points;
    }

    if (claimant.bankAccountNumber) {
      const sharedWith = accountToClaimants.get(claimant.bankAccountNumber);
      if (sharedWith && sharedWith.size > 1) {
        const points = Math.round(Math.min(30, sharedWith.size * 10));
        signals.push("shared_bank_account");
        const detail = `rekening dipakai ${sharedWith.size} penerima berbeda`;
        reasons.push(detail);
        breakdown.push({ signal: "shared_bank_account", label: "Rekening bersama", points, detail });
        riskScore += points;
      }
    }

    const highValue = (c.claimedTreatmentCost ?? 0) > 0 && c.documents.length === 0;
    if (highValue) {
      signals.push("insufficient_documentation");
      const detail = "tidak ada dokumen pendukung terlampir";
      reasons.push(detail);
      breakdown.push({ signal: "insufficient_documentation", label: "Dokumen minim", points: 20, detail });
      riskScore += 20;
    }

    const v = c.verification as { verifiedAt?: Date } | null | undefined;
    const a = c.approval as { approvedAt?: Date } | null | undefined;
    if (v?.verifiedAt && a?.approvedAt && turnaroundSd > 0) {
      const hours = (new Date(a.approvedAt).getTime() - new Date(v.verifiedAt).getTime()) / 3_600_000;
      const z = (turnaroundAvg - hours) / turnaroundSd;
      if (z > 2) {
        signals.push("unusually_fast_approval");
        const detail = `disetujui hanya ${hours.toFixed(1)} jam setelah verifikasi (rata-rata ${turnaroundAvg.toFixed(1)} jam)`;
        reasons.push(detail);
        breakdown.push({ signal: "unusually_fast_approval", label: "Persetujuan tercepat dari rata-rata", points: 15, detail });
        riskScore += 15;
      }
    }

    if (signals.length > 0) {
      const finalScore = Math.min(100, Math.round(riskScore));
      findings.push({
        claimId: c._id.toString(),
        claimNumber: c.claimNumber,
        claimantName: claimant.fullName,
        caseCategory: c.caseCategory as CaseCategory,
        signals,
        signalBreakdown: breakdown,
        riskScore: finalScore,
        riskTier: riskTier(finalScore),
        detail: reasons.join("; "),
        aiNarrative: null,
        aiFinding: null,
        aiRecommendation: null,
      });
    }
  }

  findings.sort((a, b) => b.riskScore - a.riskScore);

  const counts = {
    high: findings.filter((f) => f.riskTier === "high").length,
    medium: findings.filter((f) => f.riskTier === "medium").length,
    low: findings.filter((f) => f.riskTier === "low").length,
    safe: claims.length - findings.length,
    total: claims.length,
  };

  const top = findings.slice(0, limit);

  if (withNarrative && top.length > 0) {
    try {
      const prompt = [
        "Anda adalah analis anti-fraud untuk Jasa Raharja. Untuk setiap klaim di bawah, tulis dua hal singkat (Bahasa Indonesia) berdasarkan sinyal yang diberikan - jangan menambah asumsi baru: (1) 'finding' - satu-dua kalimat temuan utama, (2) 'recommendation' - satu kalimat rekomendasi tindak lanjut.",
        "Ini adalah SARAN untuk investigasi lebih lanjut, bukan tuduhan atau keputusan final. Jangan pernah menyarankan angka santunan baru.",
        "",
        ...top.map(
          (f, i) =>
            `${i + 1}. ${f.claimNumber} (${CASE_CATEGORY_LABELS[f.caseCategory]}, skor risiko ${f.riskScore}): sinyal - ${f.signals
              .map((s) => SIGNAL_LABELS[s])
              .join(", ")}. Detail: ${f.detail}`
        ),
        "",
        'Jawab HANYA dalam format JSON: {"items": [{"finding": "...", "recommendation": "..."}, ...]} dengan urutan yang SAMA seperti daftar di atas.',
      ].join("\n");

      const raw = await groqChatCompletion([{ role: "user", content: prompt }], { jsonMode: true, temperature: 0.2 });
      const parsed = JSON.parse(raw) as { items?: { finding?: string; recommendation?: string }[] };
      if (Array.isArray(parsed.items)) {
        parsed.items.forEach((item, i) => {
          if (!top[i]) return;
          top[i].aiFinding = item.finding ?? null;
          top[i].aiRecommendation = item.recommendation ?? null;
          top[i].aiNarrative = [item.finding, item.recommendation].filter(Boolean).join(" ");
        });
      }
    } catch (error) {
      // Non-fatal - the deterministic signals/detail are still returned even
      // if the LLM narrative step fails (e.g. GROQ_API_KEY unavailable).
      if (!(error instanceof GroqError)) throw error;
    }
  }

  return {
    scannedCount: claims.length,
    findings: top,
    counts,
    generatedAt: new Date().toISOString(),
    isSuggestionOnly: true,
  };
}

export { SIGNAL_SHORT_LABELS };
