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

type FraudFinding = {
  claimId: string;
  claimNumber: string;
  claimantName: string;
  caseCategory: string;
  signals: FraudSignal[];
  riskScore: number;
  detail: string;
  aiNarrative: string | null;
};

type ScanResult = {
  scannedCount: number;
  findings: FraudFinding[];
  generatedAt: string;
};

const SIGNAL_LABELS: Record<FraudSignal, string> = {
  over_charge: "Over Charge",
  duplicate_claimant: "Over Claim",
  shared_bank_account: "Rekening Bersama",
  insufficient_documentation: "Dokumen Minim",
  unusually_fast_approval: "Persetujuan Cepat",
};

function riskLabel(score: number) {
  if (score >= 60) return { label: "Tinggi", className: "bg-danger-100 text-danger-700" };
  if (score >= 30) return { label: "Sedang", className: "bg-warning-100 text-warning-700" };
  return { label: "Rendah", className: "bg-secondary-100 text-secondary-700" };
}

export default function FraudDetectionPage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fraud-detection").then((r) => r.json());
      if (!res.success) {
        setError(res.message ?? "Gagal menjalankan deteksi anomali");
      } else {
        setResult(res.data);
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

  return (
    <AppShell
      pageTitle="Deteksi Anomali Klaim"
      pageSubtitle="Pemindaian statistik atas pola over claim, over charge, dan potensi kecurangan lain - selalu perlu investigasi manusia sebelum bertindak"
      headerActions={
        <button className="btn btn-outline-primary btn-sm" type="button" onClick={loadData} disabled={loading}>
          <i className="ti ti-refresh mr-1" />
          {loading ? "Memindai..." : "Pindai Ulang"}
        </button>
      }
    >
      {loading && <p>Memindai seluruh klaim...</p>}
      {error && <p className="text-danger-600">{error}</p>}

      {!loading && !error && result && (
        <>
          <div className="card mb-6">
            <div className="card-body">
              <p className="text-secondary-500 text-sm">
                {result.findings.length} dari {result.scannedCount} klaim (status bukan draft) ditandai memiliki
                setidaknya satu sinyal anomali statistik. Ini adalah SARAN untuk investigasi lebih lanjut,
                bukan tuduhan atau keputusan final.
              </p>
              <p className="text-secondary-400 mt-1 mb-0 text-xs">
                Terakhir dipindai: {new Date(result.generatedAt).toLocaleString("id-ID")}
              </p>
            </div>
          </div>

          {result.findings.length === 0 ? (
            <div className="card">
              <div className="card-body">
                <p className="text-secondary-400 mb-0">Tidak ada anomali terdeteksi pada pemindaian ini.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {result.findings.map((f) => {
                const risk = riskLabel(f.riskScore);
                return (
                  <div key={f.claimId} className="card">
                    <div className="card-body">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link href={`/claims/${f.claimId}`} className="text-primary-600 font-semibold">
                            {f.claimNumber}
                          </Link>
                          <p className="text-secondary-500 mt-0.5 mb-0 text-sm">{f.claimantName}</p>
                        </div>
                        <span className={`badge ${risk.className}`}>Risiko {risk.label} ({f.riskScore})</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {f.signals.map((s) => (
                          <span key={s} className="badge bg-secondary-100 text-secondary-700">
                            {SIGNAL_LABELS[s]}
                          </span>
                        ))}
                      </div>

                      <p className="text-secondary-500 mt-3 mb-0 text-sm">{f.aiNarrative ?? f.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
