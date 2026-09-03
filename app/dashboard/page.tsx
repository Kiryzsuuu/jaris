"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import AppShell from "@/components/AppShell";

type ClaimsByStatus = { status: string; count: number };
type PaymentsByBranch = { branch: string; totalPaid: number; paymentCount: number };
type MonthlyTrend = { year: number; month: number; count: number };
type Summary = {
  claimsByStatus: ClaimsByStatus[];
  paymentsByBranch: PaymentsByBranch[];
  monthlyAccidentTrend: MonthlyTrend[];
  resolution: { avgResolutionDays: number | null; sampleSize: number };
  totalClaims: number;
  totalPaidAmount: number;
  scope: "all" | "own";
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function formatCurrency(amount: number) {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function buildQuery(params: Record<string, string>) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

type ClusterWarning = {
  centerLat: number;
  centerLng: number;
  count: number;
  branch: string | null;
  city: string | null;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);

  const [clusterWarnings, setClusterWarnings] = useState<ClusterWarning[]>([]);

  const queryParams = { branch, dateFrom, dateTo };

  const loadData = useCallback(async (params: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, branchesRes, clustersRes] = await Promise.all([
        fetch(`/api/dashboard/summary${buildQuery(params)}`).then((r) => r.json()),
        fetch("/api/dashboard/branches").then((r) => r.json()),
        fetch(`/api/accident-points/clusters${buildQuery(params)}`).then((r) => r.json()),
      ]);
      if (!summaryRes.success) {
        setError(summaryRes.message ?? "Gagal memuat data dashboard");
      } else {
        setSummary(summaryRes.data);
      }
      if (branchesRes.success) setBranches(branchesRes.data);
      if (clustersRes.success) setClusterWarnings(clustersRes.data);
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadData(queryParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setNarrative(null);
    loadData(queryParams);
  }

  async function handleGenerateNarrative() {
    setNarrativeLoading(true);
    setNarrativeError(null);
    setNarrative(null);
    try {
      const res = await fetch(`/api/dashboard/narrative${buildQuery(queryParams)}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        setNarrativeError(json.message ?? "Gagal membuat ringkasan eksekutif");
        return;
      }
      setNarrative(json.data.narrative);
    } catch {
      setNarrativeError("Tidak dapat menghubungi server");
    } finally {
      setNarrativeLoading(false);
    }
  }

  function handleExport(format: "pdf" | "excel") {
    const url = `/api/dashboard/export${buildQuery({ ...queryParams, format })}`;
    window.open(url, "_blank");
  }

  const trendData = (summary?.monthlyAccidentTrend ?? []).map((t) => ({
    label: `${MONTH_NAMES[t.month - 1]} ${t.year}`,
    count: t.count,
  }));

  return (
    <AppShell
      pageTitle="Dashboard Analitik"
      pageSubtitle={
        summary?.scope === "own"
          ? "Menampilkan lingkup klaim milik Anda sendiri"
          : "Dihitung langsung dari MongoDB aggregation pipeline"
      }
      headerActions={
        <div className="flex gap-2">
          <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => handleExport("excel")}>
            <i className="ti ti-file-spreadsheet mr-1" />
            Excel
          </button>
          <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => handleExport("pdf")}>
            <i className="ti ti-file-type-pdf mr-1" />
            PDF
          </button>
        </div>
      }
    >
      <form onSubmit={applyFilters} className="card">
        <div className="card-body flex flex-wrap items-end gap-4">
          <label className="text-sm" style={{ minWidth: 160 }}>
            <span className="mb-1 block font-medium text-[#1d2630]">Dari tanggal</span>
            <input type="date" className="form-control" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="text-sm" style={{ minWidth: 160 }}>
            <span className="mb-1 block font-medium text-[#1d2630]">Sampai tanggal</span>
            <input type="date" className="form-control" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          {branches.length > 0 && (
            <label className="text-sm" style={{ minWidth: 200 }}>
              <span className="mb-1 block font-medium text-[#1d2630]">Cabang</span>
              <select className="form-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">Semua cabang</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" className="btn btn-primary">Terapkan Filter</button>
        </div>
      </form>

      {loading && <p className="mt-4">Memuat...</p>}
      {error && <p className="text-danger-600 mt-4">{error}</p>}

      {!loading && !error && summary && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="card">
              <div className="card-body flex items-start gap-4">
                <span className="bg-primary-100 text-primary-700 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-lg">
                  <i className="ti ti-file-text" />
                </span>
                <div>
                  <span className="text-secondary-400 text-xs font-medium">Total Klaim</span>
                  <div className="mt-1 text-2xl font-bold text-[#1d2630]">{summary.totalClaims}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-body flex items-start gap-4">
                <span className="bg-success-100 text-success-700 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-lg">
                  <i className="ti ti-wallet" />
                </span>
                <div>
                  <span className="text-secondary-400 text-xs font-medium">Total Realisasi Santunan</span>
                  <div className="mt-1 text-2xl font-bold text-[#1d2630]">{formatCurrency(summary.totalPaidAmount)}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-body flex items-start gap-4">
                <span className="bg-highlight-100 text-highlight-600 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-lg">
                  <i className="ti ti-clock-check" />
                </span>
                <div>
                  <span className="text-secondary-400 text-xs font-medium">Rata-rata Penyelesaian</span>
                  <div className="mt-1 text-2xl font-bold text-[#1d2630]">
                    {summary.resolution.avgResolutionDays !== null ? `${summary.resolution.avgResolutionDays} hari` : "N/A"}
                  </div>
                  <div className="text-secondary-400 mt-1 text-xs">dari {summary.resolution.sampleSize} klaim lunas</div>
                </div>
              </div>
            </div>
          </div>

          {clusterWarnings.length > 0 && (
            <div className="card border-danger-500 mt-6 border-l-4">
              <div className="card-body">
                <h2 className="text-danger-600 flex items-center gap-2 text-base font-semibold">
                  <i className="ti ti-alert-triangle" />
                  Sinyal Peringatan - Titik Rawan Kecelakaan
                </h2>
                <p className="text-secondary-400 mt-2 text-sm">
                  Terdeteksi {clusterWarnings.length} klaster kecelakaan berulang dalam radius dekat
                  (analisis pola dari data peta kecelakaan).
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {clusterWarnings.slice(0, 8).map((c, i) => (
                    <li key={i}>{c.city ?? "?"} ({c.branch ?? "?"}) - {c.count} kejadian berdekatan</li>
                  ))}
                </ul>
                <Link href="/accident-map" className="text-primary-600 mt-2 inline-block text-sm font-semibold">
                  Lihat di peta
                </Link>
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card md:col-span-2">
              <div className="card-header">
                <h5>Jumlah Klaim per Status</h5>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={summary.claimsByStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                    <XAxis dataKey="status" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--ai-500)" name="Jumlah Klaim" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h5>Realisasi Santunan per Cabang</h5>
              </div>
              <div className="card-body">
                {summary.paymentsByBranch.length === 0 ? (
                  <p className="text-secondary-400 text-sm">Belum ada data pencairan pada filter ini.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={summary.paymentsByBranch}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                      <XAxis dataKey="branch" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="totalPaid" fill="var(--accent-500)" name="Total Santunan" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h5>Tren Kecelakaan Bulanan</h5>
              </div>
              <div className="card-body">
                {trendData.length === 0 ? (
                  <p className="text-secondary-400 text-sm">Belum ada data pada filter ini.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="var(--highlight-600)" name="Jumlah Kecelakaan" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card md:col-span-2">
              <div className="card-header">
                <h5>Ringkasan Eksekutif (AI)</h5>
              </div>
              <div className="card-body">
                <p className="text-secondary-400 text-sm">
                  Dihasilkan Groq dari angka agregat di atas - bukan dari data mentah, dan tidak
                  memberi keputusan/otorisasi.
                </p>
                <button
                  className="btn btn-primary mt-3"
                  onClick={handleGenerateNarrative}
                  disabled={narrativeLoading}
                >
                  {narrativeLoading ? "Membuat ringkasan..." : "Buat Ringkasan Eksekutif"}
                </button>
                {narrativeError && <p className="text-danger-600 mt-2 text-sm">{narrativeError}</p>}
                {narrative && <p className="mt-3 text-sm whitespace-pre-wrap">{narrative}</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
