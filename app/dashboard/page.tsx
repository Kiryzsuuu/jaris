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
import { CASE_CATEGORY_LABELS } from "@/lib/claimTypes";

type ClaimsByStatus = { status: string; count: number };
type PaymentsByBranch = { branch: string; totalPaid: number; paymentCount: number };
type MonthlyTrend = { year: number; month: number; count: number };
type MonthlyClaimsAndPayments = { year: number; month: number; claimsCount: number; paidAmount: number };
type ClaimsByCategory = { caseCategory: string; count: number };
type Summary = {
  claimsByStatus: ClaimsByStatus[];
  paymentsByBranch: PaymentsByBranch[];
  monthlyAccidentTrend: MonthlyTrend[];
  monthlyClaimsAndPayments: MonthlyClaimsAndPayments[];
  trendProjection: MonthlyTrend[];
  claimsByCategory: ClaimsByCategory[];
  resolution: {
    avgResolutionDays: number | null;
    sampleSize: number;
    slaTargetDays: number;
    withinSlaCount: number;
    withinSlaPercent: number | null;
  };
  totalClaims: number;
  totalPaidAmount: number;
  scope: "all" | "own";
};

type FraudFinding = {
  claimId: string;
  claimNumber: string;
  claimantName: string;
  riskScore: number;
  aiNarrative: string | null;
  detail: string;
};

type ActionableClaim = {
  id: string;
  claimNumber: string;
  status: string;
  caseCategory: string;
  claimant: { fullName?: string };
};

type ActivityItem = { id: string; text: string; color: string; at: string };

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const STAT_ACCENT_COLORS: Record<string, string> = {
  navy: "var(--primary-500)",
  gold: "var(--accent-500)",
  blue: "var(--ai-500)",
  slate: "var(--ink-300)",
  red: "#dc2626",
};

/** Colored left accent, label top-left, tone-colored icon chip top-right, big figure below. */
function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  tone: "navy" | "gold" | "blue" | "slate" | "red";
  className?: string;
}) {
  return (
    <div className={`card ${className}`} style={{ borderLeft: `3px solid ${STAT_ACCENT_COLORS[tone]}` }}>
      <div className="card-body">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-secondary-400 text-xs">{label}</span>
          <span className={`stats-icon stats-icon-${tone}`}>
            <i className={`ti ${icon}`} />
          </span>
        </div>
        <div className="text-2xl font-semibold text-[#1e293b]">{value}</div>
        {sub && <div className="text-secondary-400 mt-1 text-xs">{sub}</div>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="dashboard-section-title">{children}</h2>;
}

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
  peakHourRange?: string | null;
  recommendation?: string | null;
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
  const [fraudFindings, setFraudFindings] = useState<FraudFinding[]>([]);
  // Distinct from fraudFindings.length: a user without fraud:view permission
  // never gets fraudRes.success, so this stays false and the card is hidden
  // entirely - a user who does have the permission but scores a clean scan
  // still sees the card with a "no anomalies" message.
  const [fraudLoaded, setFraudLoaded] = useState(false);
  const [fraudHighCount, setFraudHighCount] = useState(0);
  const [actionableClaims, setActionableClaims] = useState<ActionableClaim[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const queryParams = { branch, dateFrom, dateTo };

  const loadData = useCallback(async (params: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, branchesRes, clustersRes, fraudRes, claimsRes, activityRes] = await Promise.all([
        fetch(`/api/dashboard/summary${buildQuery(params)}`).then((r) => r.json()),
        fetch("/api/dashboard/branches").then((r) => r.json()),
        fetch(`/api/accident-points/clusters${buildQuery(params)}`).then((r) => r.json()),
        fetch("/api/fraud-detection").then((r) => r.json()),
        fetch("/api/claims").then((r) => r.json()),
        fetch("/api/dashboard/activity").then((r) => r.json()),
      ]);
      if (!summaryRes.success) {
        setError(summaryRes.message ?? "Gagal memuat data dashboard");
      } else {
        setSummary(summaryRes.data);
      }
      if (branchesRes.success) setBranches(branchesRes.data);
      if (clustersRes.success) setClusterWarnings(clustersRes.data);
      if (fraudRes.success) {
        setFraudFindings(fraudRes.data.findings ?? []);
        setFraudHighCount(fraudRes.data.counts?.high ?? 0);
        setFraudLoaded(true);
      }
      if (claimsRes.success) {
        const actionable = (claimsRes.data as ActionableClaim[]).filter((c) =>
          ["submitted", "verified"].includes(c.status)
        );
        setActionableClaims(actionable.slice(0, 5));
      }
      if (activityRes.success) setActivity(activityRes.data);
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

  const historicalTrend = (summary?.monthlyAccidentTrend ?? []).map((t) => ({
    label: `${MONTH_NAMES[t.month - 1]} ${t.year}`,
    actual: t.count as number | undefined,
    projected: undefined as number | undefined,
  }));
  const projectedTrend = (summary?.trendProjection ?? []).map((t) => ({
    label: `${MONTH_NAMES[t.month - 1]} ${t.year}`,
    actual: undefined as number | undefined,
    projected: t.count as number | undefined,
  }));
  // Bridge point so the dashed projection line visually connects to where
  // the solid historical line ends, instead of starting from a gap.
  if (historicalTrend.length > 0 && projectedTrend.length > 0) {
    historicalTrend[historicalTrend.length - 1].projected = historicalTrend[historicalTrend.length - 1].actual;
  }
  const trendData = [...historicalTrend, ...projectedTrend];

  const categoryData = (summary?.claimsByCategory ?? []).map((c) => ({
    label: CASE_CATEGORY_LABELS[c.caseCategory as keyof typeof CASE_CATEGORY_LABELS] ?? c.caseCategory,
    count: c.count,
  }));

  const topFraudFindings = fraudFindings.slice(0, 3);
  const topClusterWarnings = clusterWarnings.filter((c) => c.recommendation).slice(0, 3);
  const hasRecommendations = Boolean(narrative) || topClusterWarnings.length > 0 || topFraudFindings.length > 0;

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
            <span className="mb-1 block font-medium text-[#1e293b]">Dari tanggal</span>
            <input type="date" className="form-control" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="text-sm" style={{ minWidth: 160 }}>
            <span className="mb-1 block font-medium text-[#1e293b]">Sampai tanggal</span>
            <input type="date" className="form-control" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          {branches.length > 0 && (
            <label className="text-sm" style={{ minWidth: 200 }}>
              <span className="mb-1 block font-medium text-[#1e293b]">Cabang</span>
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
          <SectionTitle>Ringkasan</SectionTitle>
          <div className="grid grid-cols-12 gap-4">
            <StatCard
              className="col-span-12 sm:col-span-6 lg:col-span-3"
              label="Total klaim"
              value={String(summary.totalClaims)}
              icon="ti-file-text"
              tone="navy"
            />
            <StatCard
              className="col-span-12 sm:col-span-6 lg:col-span-3"
              label="Total realisasi santunan"
              value={formatCurrency(summary.totalPaidAmount)}
              icon="ti-wallet"
              tone="gold"
            />
            <StatCard
              className="col-span-6 sm:col-span-4 lg:col-span-2"
              label="Rata-rata penyelesaian"
              value={
                summary.resolution.avgResolutionDays !== null
                  ? `${summary.resolution.avgResolutionDays} hari`
                  : "N/A"
              }
              sub={`dari ${summary.resolution.sampleSize} klaim lunas`}
              icon="ti-clock-check"
              tone="blue"
            />
            <StatCard
              className="col-span-6 sm:col-span-4 lg:col-span-2"
              label={`SLA (${summary.resolution.slaTargetDays} hari)`}
              value={
                summary.resolution.withinSlaPercent !== null
                  ? `${summary.resolution.withinSlaPercent}%`
                  : "N/A"
              }
              sub={`${summary.resolution.withinSlaCount} dari ${summary.resolution.sampleSize} tepat waktu`}
              icon="ti-target-arrow"
              tone="slate"
            />
            {fraudLoaded && (
              <StatCard
                className="col-span-12 sm:col-span-4 lg:col-span-2"
                label="Potensi Fraud Terdeteksi"
                value={String(fraudHighCount)}
                sub={fraudHighCount > 0 ? "Perlu investigasi" : "Tidak ada risiko tinggi"}
                icon="ti-alert-triangle"
                tone="red"
              />
            )}
          </div>

          {clusterWarnings.length > 0 && (
            <div className="dashboard-alert-banner mt-4">
              <div className="dashboard-alert-icon">
                <i className="ti ti-alert-triangle" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="dashboard-alert-title">Sinyal Peringatan - Titik Rawan Kecelakaan</h2>
                <p className="dashboard-alert-desc">
                  Terdeteksi {clusterWarnings.length} klaster kecelakaan berulang dalam radius dekat
                  (analisis pola dari data peta kecelakaan).
                </p>
                <div className="dashboard-alert-grid">
                  {clusterWarnings.slice(0, 6).map((c, i) => (
                    <div key={i} className="dashboard-alert-item">
                      <span className="dashboard-alert-item-title">
                        {c.city ?? "?"} ({c.branch ?? "?"})
                      </span>
                      <span className="dashboard-alert-item-detail">
                        {c.count} kejadian berdekatan{c.peakHourRange && `, jam rawan ${c.peakHourRange}`}
                      </span>
                    </div>
                  ))}
                </div>
                {clusterWarnings.length > 6 && (
                  <p className="dashboard-alert-more">+{clusterWarnings.length - 6} klaster lainnya</p>
                )}
                <Link href="/accident-map" className="dashboard-alert-link">
                  Lihat di peta
                </Link>
              </div>
            </div>
          )}

          <SectionTitle>Analitik Klaim & Kecelakaan</SectionTitle>
          <div className="grid grid-cols-12 gap-4">
            <div className="card col-span-12 lg:col-span-8">
              <div className="card-header">
                <h5>Tren Klaim & Pencairan</h5>
                <span className="text-secondary-400 text-xs">6 bulan terakhir, berdasarkan tanggal pengajuan/pencairan</span>
              </div>
              <div className="card-body">
                {(summary.monthlyClaimsAndPayments ?? []).every((m) => m.claimsCount === 0 && m.paidAmount === 0) ? (
                  <p className="text-secondary-400 text-sm">Belum ada data pada filter ini.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={(summary.monthlyClaimsAndPayments ?? []).map((m) => ({
                        label: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
                        claimsCount: m.claimsCount,
                        paidAmount: m.paidAmount,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                      <XAxis dataKey="label" />
                      <YAxis yAxisId="left" allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatCurrency(Number(v))} width={90} />
                      <Tooltip formatter={(value, name) => (name === "paidAmount" ? formatCurrency(Number(value)) : value)} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="claimsCount" fill="var(--ai-500)" name="Klaim Diajukan" radius={[2, 2, 0, 0]} />
                      <Bar yAxisId="right" dataKey="paidAmount" fill="var(--accent-500)" name="Santunan Dicairkan" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card col-span-12 lg:col-span-4">
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
                    <Bar dataKey="count" fill="var(--ai-500)" name="Jumlah Klaim" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card col-span-12 lg:col-span-4">
              <div className="card-header">
                <h5>Realisasi Santunan per Cabang</h5>
              </div>
              <div className="card-body">
                {summary.paymentsByBranch.length === 0 ? (
                  <p className="text-secondary-400 text-sm">Belum ada data pencairan pada filter ini.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={summary.paymentsByBranch}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                      <XAxis dataKey="branch" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="totalPaid" fill="var(--accent-500)" name="Total Santunan" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card col-span-12 lg:col-span-4">
              <div className="card-header">
                <h5>Tren Kecelakaan Bulanan</h5>
              </div>
              <div className="card-body">
                {trendData.length === 0 ? (
                  <p className="text-secondary-400 text-sm">Belum ada data pada filter ini.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                        <XAxis dataKey="label" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="actual" stroke="var(--highlight-600)" name="Jumlah Kecelakaan" strokeWidth={2} connectNulls={false} />
                        <Line type="monotone" dataKey="projected" stroke="var(--highlight-600)" name="Proyeksi" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                    {summary.trendProjection.length > 0 && (
                      <p className="text-secondary-400 mt-2 mb-0 text-xs">
                        Garis putus-putus adalah proyeksi statistik sederhana (regresi linear) dari tren
                        historis di atas - bukan prediksi pasti.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="card col-span-12 lg:col-span-4">
              <div className="card-header">
                <h5>Korban per Kategori Kasus</h5>
              </div>
              <div className="card-body">
                {categoryData.every((c) => c.count === 0) ? (
                  <p className="text-secondary-400 text-sm">Belum ada data pada filter ini.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="label" width={140} />
                      <Tooltip />
                      <Bar dataKey="count" fill="var(--primary-500)" name="Jumlah Klaim" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {(actionableClaims.length > 0 || activity.length > 0) && (
            <>
              <SectionTitle>Tindakan & Aktivitas</SectionTitle>
              <div className="grid grid-cols-12 gap-4">
                {actionableClaims.length > 0 && (
                  <div className="card col-span-12 lg:col-span-8">
                    <div className="card-header flex items-center justify-between">
                      <h5>Klaim Memerlukan Tindakan</h5>
                      <Link href="/claims" className="text-primary-600 text-sm font-semibold">
                        Lihat semua
                      </Link>
                    </div>
                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table w-full">
                          <thead>
                            <tr>
                              <th className="ps-6">No. Klaim</th>
                              <th>Pemohon</th>
                              <th>Jenis</th>
                              <th className="pe-6">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {actionableClaims.map((c) => (
                              <tr key={c.id}>
                                <td className="ps-6">
                                  <Link href={`/claims/${c.id}`} className="text-primary-600 font-semibold">
                                    {c.claimNumber}
                                  </Link>
                                </td>
                                <td>{c.claimant?.fullName ?? "-"}</td>
                                <td className="text-secondary-400">{CASE_CATEGORY_LABELS[c.caseCategory as keyof typeof CASE_CATEGORY_LABELS] ?? c.caseCategory}</td>
                                <td className="pe-6">
                                  <span className={`badge ${c.status === "submitted" ? "bg-ai-100 text-ai-700" : "bg-accent-100 text-accent-700"}`}>
                                    {c.status === "submitted" ? "Diajukan" : "Diverifikasi"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activity.length > 0 && (
                  <div className="card col-span-12 lg:col-span-4">
                    <div className="card-header">
                      <h5>Aktivitas Terbaru</h5>
                      <span className="text-secondary-400 text-xs">Real-time</span>
                    </div>
                    <div className="card-body">
                      <ul className="mb-0 list-none space-y-3 pl-0 text-sm">
                        {activity.map((a) => (
                          <li key={a.id} className="flex items-start gap-2.5">
                            <span className="dashboard-activity-dot" style={{ backgroundColor: a.color }} />
                            <span>
                              <span className="block text-[#1e293b]">{a.text}</span>
                              <span className="text-secondary-400 text-xs">{new Date(a.at).toLocaleString("id-ID")}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <SectionTitle>Wawasan AI (Saran - Bukan Keputusan Otomatis)</SectionTitle>
          <div className="grid grid-cols-12 gap-4">
            {fraudLoaded && (
              <div className="card col-span-12 lg:col-span-4">
                <div className="card-header flex items-center justify-between">
                  <h5>Ringkasan Deteksi Anomali Klaim</h5>
                  <Link href="/fraud-detection" className="text-primary-600 text-sm font-semibold">
                    Lihat semua
                  </Link>
                </div>
                <div className="card-body">
                  {topFraudFindings.length === 0 ? (
                    <p className="text-secondary-400 mb-0 text-sm">Tidak ada anomali terdeteksi pada pemindaian ini.</p>
                  ) : (
                    <ul className="mb-0 list-none space-y-2 pl-0 text-sm">
                      {topFraudFindings.map((f) => (
                        <li key={f.claimId} className="flex items-start justify-between gap-2">
                          <span>
                            <Link href={`/claims/${f.claimId}`} className="text-primary-600 font-semibold">
                              {f.claimNumber}
                            </Link>{" "}
                            <span className="text-secondary-500">{f.claimantName}</span>
                          </span>
                          <span className="badge bg-danger-100 text-danger-700 whitespace-nowrap">
                            {f.riskScore}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {hasRecommendations && (
              <div className="card col-span-12 lg:col-span-4">
                <div className="card-header">
                  <h5>Rekomendasi AI</h5>
                </div>
                <div className="card-body">
                  <ul className="mb-0 list-disc space-y-1.5 pl-5 text-sm">
                    {narrative && <li>{narrative}</li>}
                    {topClusterWarnings.map((c, i) => (
                      <li key={`cluster-${i}`}>{c.recommendation}</li>
                    ))}
                    {topFraudFindings
                      .filter((f) => f.aiNarrative)
                      .map((f) => (
                        <li key={`fraud-${f.claimId}`}>
                          {f.claimNumber}: {f.aiNarrative}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="card col-span-12 lg:col-span-4">
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
