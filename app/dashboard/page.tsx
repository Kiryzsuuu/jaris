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
        <div className="d-flex gap-2">
          <button className="btn-date-picker" type="button" onClick={() => handleExport("excel")}>
            <i className="bi bi-file-earmark-excel" />
            <span>Excel</span>
          </button>
          <button className="btn-date-picker" type="button" onClick={() => handleExport("pdf")}>
            <i className="bi bi-file-earmark-pdf" />
            <span>PDF</span>
          </button>
        </div>
      }
    >
      <form onSubmit={applyFilters} className="card mb-4">
        <div className="d-flex gap-3 flex-wrap align-items-end">
          <label className="login-form-label" style={{ minWidth: 160 }}>
            Dari tanggal
            <input
              type="date"
              className="form-control"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="login-form-label" style={{ minWidth: 160 }}>
            Sampai tanggal
            <input
              type="date"
              className="form-control"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          {branches.length > 0 && (
            <label className="login-form-label" style={{ minWidth: 200 }}>
              Cabang
              <select className="form-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">Semua cabang</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" className="btn btn-dark">
            Terapkan Filter
          </button>
        </div>
      </form>

      {loading && <p>Memuat...</p>}
      {error && <p className="text-danger">{error}</p>}

      {!loading && !error && summary && (
        <>
          <div className="row g-4 mb-1">
            <div className="col-md-4">
              <div className="card card-stat">
                <span className="stat-label">Total Klaim</span>
                <div className="stat-value">{summary.totalClaims}</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card card-stat">
                <span className="stat-label">Total Realisasi Santunan</span>
                <div className="stat-value">{formatCurrency(summary.totalPaidAmount)}</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card card-stat">
                <span className="stat-label">Rata-rata Penyelesaian</span>
                <div className="stat-value">
                  {summary.resolution.avgResolutionDays !== null
                    ? `${summary.resolution.avgResolutionDays} hari`
                    : "N/A"}
                </div>
                <div className="text-muted-green" style={{ fontSize: 12 }}>
                  dari {summary.resolution.sampleSize} klaim lunas
                </div>
              </div>
            </div>
          </div>

          {clusterWarnings.length > 0 && (
            <div className="card mt-4" style={{ borderLeft: "4px solid var(--sys-red)" }}>
              <h2 className="card-title" style={{ color: "var(--sys-red)" }}>
                <i className="bi bi-exclamation-triangle-fill me-2" />
                Sinyal Peringatan - Titik Rawan Kecelakaan
              </h2>
              <p className="text-muted-green" style={{ fontSize: 13 }}>
                Terdeteksi {clusterWarnings.length} klaster kecelakaan berulang dalam radius dekat
                (analisis pola dari data peta kecelakaan).
              </p>
              <ul style={{ paddingLeft: 18, fontSize: 14, marginBottom: 8 }}>
                {clusterWarnings.slice(0, 8).map((c, i) => (
                  <li key={i}>
                    {c.city ?? "?"} ({c.branch ?? "?"}) - {c.count} kejadian berdekatan
                  </li>
                ))}
              </ul>
              <Link href="/accident-map" className="fw-semibold" style={{ fontSize: 13 }}>
                Lihat di peta <i className="bi bi-arrow-right" />
              </Link>
            </div>
          )}

          <div className="row g-4 mt-1">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Jumlah Klaim per Status</h2>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={summary.claimsByStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="status" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#072F1F" name="Jumlah Klaim" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">
                  <h2 className="card-title">Realisasi Santunan per Cabang</h2>
                </div>
                {summary.paymentsByBranch.length === 0 ? (
                  <p className="text-muted-green" style={{ fontSize: 14 }}>Belum ada data pencairan pada filter ini.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={summary.paymentsByBranch}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="branch" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="totalPaid" fill="#B4F105" name="Total Santunan" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">
                  <h2 className="card-title">Tren Kecelakaan Bulanan</h2>
                </div>
                {trendData.length === 0 ? (
                  <p className="text-muted-green" style={{ fontSize: 14 }}>Belum ada data pada filter ini.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#F97316" name="Jumlah Kecelakaan" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Ringkasan Eksekutif (AI)</h2>
                </div>
                <p className="text-muted-green" style={{ fontSize: 13 }}>
                  Dihasilkan Groq dari angka agregat di atas - bukan dari data mentah, dan tidak
                  memberi keputusan/otorisasi.
                </p>
                <button
                  className="btn btn-dark"
                  style={{ width: "fit-content" }}
                  onClick={handleGenerateNarrative}
                  disabled={narrativeLoading}
                >
                  {narrativeLoading ? "Membuat ringkasan..." : "Buat Ringkasan Eksekutif"}
                </button>
                {narrativeError && <p className="text-danger mt-2" style={{ fontSize: 13 }}>{narrativeError}</p>}
                {narrative && (
                  <p className="mt-3" style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {narrative}
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
