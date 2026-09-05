"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

type FraudSignal =
  | "over_charge"
  | "duplicate_claimant"
  | "shared_bank_account"
  | "insufficient_documentation"
  | "unusually_fast_approval";

type SignalContribution = { signal: FraudSignal; label: string; points: number; detail: string };

type FraudFinding = {
  claimId: string;
  claimNumber: string;
  claimantName: string;
  caseCategory: string;
  signals: FraudSignal[];
  signalBreakdown: SignalContribution[];
  riskScore: number;
  riskTier: "high" | "medium" | "low";
  detail: string;
  aiNarrative: string | null;
  aiFinding: string | null;
  aiRecommendation: string | null;
};

type ScanResult = {
  scannedCount: number;
  findings: FraudFinding[];
  counts: { high: number; medium: number; low: number; safe: number; total: number };
  generatedAt: string;
};

const SIGNAL_LABELS: Record<FraudSignal, string> = {
  over_charge: "Z-Score Tinggi",
  duplicate_claimant: "NIK Ganda",
  shared_bank_account: "Rekening Bersama",
  insufficient_documentation: "Dokumen Minim",
  unusually_fast_approval: "Persetujuan Cepat",
};

const TIER_META = {
  high: { label: "Tinggi", badge: "bg-danger-100 text-danger-700", bar: "#DC2626", desc: "Risiko Sangat Tinggi" },
  medium: { label: "Sedang", badge: "bg-highlight-100 text-highlight-700", bar: "#F2A900", desc: "Risiko Sedang" },
  low: { label: "Rendah", badge: "bg-secondary-100 text-secondary-700", bar: "#16A34A", desc: "Risiko Rendah" },
} as const;

function RiskGauge({ score, tier }: { score: number; tier: FraudFinding["riskTier"] }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative h-[88px] w-[88px]">
        <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="8" />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={TIER_META[tier].bar}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold" style={{ color: TIER_META[tier].bar }}>{score}</span>
          <span className="text-secondary-400 text-[9px]">/ 100</span>
        </div>
      </div>
      <p className="mt-1.5 mb-0 text-sm font-semibold" style={{ color: TIER_META[tier].bar }}>
        <i className="ti ti-alert-triangle mr-1" />
        {TIER_META[tier].desc}
      </p>
    </div>
  );
}

export default function FraudDetectionPage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<"all" | "high" | "medium">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fraud-detection").then((r) => r.json());
      if (!res.success) {
        setError(res.message ?? "Gagal menjalankan deteksi anomali");
      } else {
        setResult(res.data);
        setSelectedId((prev) => prev ?? res.data.findings[0]?.claimId ?? null);
      }
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial scan on mount
    loadData();
  }, [loadData]);

  async function handleDismiss(claimId: string) {
    setDismissing(true);
    try {
      await fetch(`/api/fraud-detection/${claimId}/dismiss`, { method: "POST" });
      await loadData();
      setSelectedId(null);
    } finally {
      setDismissing(false);
    }
  }

  function handleReport(claimId: string) {
    window.open(`/api/fraud-detection/${claimId}/report`, "_blank");
  }

  const findings = result?.findings ?? [];
  const filtered = findings.filter((f) => tierFilter === "all" || f.riskTier === tierFilter);
  const selected = findings.find((f) => f.claimId === selectedId) ?? filtered[0] ?? null;

  return (
    <AppShell
      pageTitle="Deteksi Anomali & Fraud"
      pageSubtitle={result ? `Scan statistik otomatis - diperbarui ${new Date(result.generatedAt).toLocaleString("id-ID")}` : "Memuat..."}
      headerActions={
        <button className="btn btn-gold btn-sm" type="button" onClick={loadData} disabled={loading}>
          <i className="ti ti-refresh mr-1" />
          {loading ? "Memindai..." : "Scan Ulang"}
        </button>
      }
    >
      {loading && !result && <p>Memindai seluruh klaim...</p>}
      {error && <p className="text-danger-600">{error}</p>}

      {result && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card">
              <div className="card-body flex items-center gap-3 py-3">
                <span className="stats-icon stats-icon-red"><i className="ti ti-alert-triangle" /></span>
                <div>
                  <div className="text-secondary-400 text-[10px] font-medium">Risiko Tinggi</div>
                  <div className="text-danger-600 text-xl font-bold">{result.counts.high}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-body flex items-center gap-3 py-3">
                <span className="stats-icon" style={{ backgroundColor: "#FFFBEB", color: "#D4920A" }}><i className="ti ti-alert-circle" /></span>
                <div>
                  <div className="text-secondary-400 text-[10px] font-medium">Risiko Sedang</div>
                  <div className="text-xl font-bold" style={{ color: "#D4920A" }}>{result.counts.medium}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-body flex items-center gap-3 py-3">
                <span className="stats-icon" style={{ backgroundColor: "#F0FDF4", color: "#16A34A" }}><i className="ti ti-shield-check" /></span>
                <div>
                  <div className="text-secondary-400 text-[10px] font-medium">Aman</div>
                  <div className="text-xl font-bold" style={{ color: "#16A34A" }}>{result.counts.safe}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-body flex items-center gap-3 py-3">
                <span className="stats-icon stats-icon-blue"><i className="ti ti-scan" /></span>
                <div>
                  <div className="text-secondary-400 text-[10px] font-medium">Total Discan</div>
                  <div className="text-primary-700 text-xl font-bold">{result.counts.total}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <div className="card self-start">
              <div className="card-body">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[#1e293b]">Klaim Berpotensi Anomali</h2>
                    <p className="text-secondary-400 mb-0 text-xs">Diurutkan berdasarkan skor risiko tertinggi</p>
                  </div>
                  <div className="flex gap-1.5">
                    {(["high", "medium", "all"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTierFilter(t)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          tierFilter === t ? "bg-danger-600 text-white" : "bg-secondary-100 text-secondary-500"
                        }`}
                      >
                        {t === "high" ? "Tinggi" : t === "medium" ? "Sedang" : "Semua"}
                      </button>
                    ))}
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <p className="text-secondary-400 mb-0 text-sm">Tidak ada klaim pada filter ini.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>No. Klaim</th>
                          <th>Pemohon</th>
                          <th>Skor Risiko</th>
                          <th>Flag Anomali</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((f) => (
                          <tr
                            key={f.claimId}
                            onClick={() => setSelectedId(f.claimId)}
                            className={`cursor-pointer ${selected?.claimId === f.claimId ? "bg-primary-50" : ""}`}
                          >
                            <td>
                              <Link href={`/claims/${f.claimId}`} className="text-primary-600 font-semibold" onClick={(e) => e.stopPropagation()}>
                                {f.claimNumber}
                              </Link>
                            </td>
                            <td>{f.claimantName}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="bg-secondary-100 h-1.5 w-16 overflow-hidden rounded-full">
                                  <div className="h-full rounded-full" style={{ width: `${f.riskScore}%`, backgroundColor: TIER_META[f.riskTier].bar }} />
                                </div>
                                <span className="text-xs font-bold" style={{ color: TIER_META[f.riskTier].bar }}>{f.riskScore}</span>
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-1">
                                {f.signals.slice(0, 2).map((s) => (
                                  <span key={s} className={`badge ${TIER_META[f.riskTier].badge}`}>
                                    {SIGNAL_LABELS[s]}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {selected && (
                <div className="card">
                  <div className="card-body">
                    <p className="mb-2 text-xs font-semibold text-[#1e293b]">
                      <i className="ti ti-zoom-scan mr-1" /> Detail Risiko - <span className="text-primary-600">{selected.claimNumber}</span>
                    </p>
                    <RiskGauge score={selected.riskScore} tier={selected.riskTier} />
                    <div className="mt-2 flex flex-col gap-1.5">
                      {selected.signalBreakdown.map((s) => (
                        <div key={s.signal} className="border-secondary-100 bg-secondary-50 flex items-center gap-2 rounded-lg border px-2.5 py-2">
                          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: TIER_META[selected.riskTier].bar }} />
                          <span className="flex-1 text-xs text-[#334155]">{s.label}</span>
                          <span className="text-xs font-bold" style={{ color: TIER_META[selected.riskTier].bar }}>+{s.points} poin</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selected && (
                <div
                  className="rounded-xl p-4 text-white"
                  style={{ background: "linear-gradient(160deg, var(--primary-700) 0%, var(--ai-600) 100%)" }}
                >
                  <p className="mb-0.5 text-xs font-bold">
                    <i className="ti ti-sparkles text-highlight-400 mr-1" /> Narasi AI
                  </p>
                  <p className="mb-3 text-[10px] text-white/40">Analisis otomatis Groq</p>

                  {selected.aiFinding && (
                    <div className="mb-2 rounded-lg bg-white/10 p-2.5">
                      <p className="text-highlight-400 mb-1 text-[9px] font-bold tracking-wide uppercase">Temuan Utama</p>
                      <p className="mb-0 text-xs leading-relaxed text-white/85">{selected.aiFinding}</p>
                    </div>
                  )}
                  {selected.aiRecommendation && (
                    <div className="mb-3 rounded-lg bg-white/10 p-2.5">
                      <p className="text-highlight-400 mb-1 text-[9px] font-bold tracking-wide uppercase">Rekomendasi</p>
                      <p className="mb-0 text-xs leading-relaxed text-white/85">{selected.aiRecommendation}</p>
                    </div>
                  )}
                  {!selected.aiFinding && !selected.aiRecommendation && (
                    <p className="mb-3 text-xs text-white/70">{selected.detail}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={dismissing}
                      onClick={() => handleDismiss(selected.claimId)}
                      className="flex-1 rounded-lg border border-white/20 bg-white/10 py-2 text-xs font-semibold text-white"
                    >
                      {dismissing ? "Memproses..." : "Abaikan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReport(selected.claimId)}
                      className="btn-gold flex-1 rounded-lg py-2 text-xs font-bold"
                    >
                      Buat Laporan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
