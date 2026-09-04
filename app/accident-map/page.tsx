"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AppShell from "@/components/AppShell";
import type { AccidentPointMarker, ClusterMarker } from "@/components/LeafletMap";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      Memuat peta...
    </div>
  ),
});

const INDONESIA_CENTER: [number, number] = [-2.5, 118];

function buildQuery(params: Record<string, string>) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

const VEHICLE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "motor", label: "Sepeda Motor" },
  { value: "mobil", label: "Mobil" },
  { value: "truk_bus", label: "Truk/Bus" },
  { value: "lainnya", label: "Lainnya" },
];

type RiskFactor = { label: string; detail: string };
type RiskWeather = { condition: string; isHazardous: boolean; source: "forecast" | "archive" } | null;
type RiskResult = {
  riskScore: number;
  riskLevel: "rendah" | "sedang" | "tinggi";
  factors: RiskFactor[];
  narrative: string | null;
  weather: RiskWeather;
  sampleSize: number;
  lowConfidence: boolean;
};

const RISK_LEVEL_META: Record<RiskResult["riskLevel"], { label: string; emoji: string; className: string }> = {
  tinggi: { label: "Risiko Tinggi", emoji: "🔴", className: "bg-danger-100 text-danger-700" },
  sedang: { label: "Risiko Sedang", emoji: "🟡", className: "bg-warning-100 text-warning-700" },
  rendah: { label: "Risiko Rendah", emoji: "🟢", className: "bg-success-100 text-success-700" },
};

function RiskPredictionPanel({ branches }: { branches: string[] }) {
  const [branch, setBranch] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [vehicleType, setVehicleType] = useState("motor");
  const [result, setResult] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!branch || !dateTime) {
      setError("Pilih wilayah dan waktu terlebih dahulu");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/accident-points/risk-prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, dateTime: new Date(dateTime).toISOString(), vehicleType }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Gagal menghitung estimasi risiko");
        return;
      }
      setResult(json.data);
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-body">
        <p className="text-secondary-500 mb-4 text-sm">
          Estimasi risiko dihitung dari pola kecelakaan historis di wilayah yang dipilih (kepadatan, jam
          kejadian, jenis kendaraan, keparahan) ditambah cuaca nyata dari Open-Meteo - bukan model
          terlatih, dan bukan keputusan final. Selalu gunakan penilaian manusia.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="form-label">Wilayah/Cabang</label>
            <select className="form-select" value={branch} onChange={(e) => setBranch(e.target.value)} required>
              <option value="">Pilih wilayah</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Tanggal &amp; Jam</label>
            <input
              type="datetime-local"
              className="form-control"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Jenis Kendaraan</label>
            <select className="form-select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {VEHICLE_TYPE_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Menghitung..." : "Hitung Risiko"}
          </button>
        </form>

        {error && <p className="text-danger-600 mt-3 mb-0 text-sm">{error}</p>}

        {result && (
          <div className="border-ink-200 mt-5 border-t pt-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`badge ${RISK_LEVEL_META[result.riskLevel].className} text-base`}>
                {RISK_LEVEL_META[result.riskLevel].emoji} {RISK_LEVEL_META[result.riskLevel].label} —{" "}
                {result.riskScore}%
              </span>
              {result.lowConfidence && (
                <span className="badge bg-secondary-100 text-secondary-700">Data historis terbatas</span>
              )}
            </div>

            {result.narrative && (
              <p className="mt-3 mb-0 text-sm">
                <strong>Faktor utama:</strong> {result.narrative}
              </p>
            )}

            {result.factors.length > 0 && (
              <ul className="text-secondary-500 mt-2 mb-0 list-disc pl-5 text-sm">
                {result.factors.map((f) => (
                  <li key={f.label}>
                    <strong>{f.label}:</strong> {f.detail}
                  </li>
                ))}
              </ul>
            )}

            {result.weather && (
              <p className="text-secondary-400 mt-2 mb-0 text-xs">
                Cuaca: {result.weather.condition} ({result.weather.source === "forecast" ? "prakiraan" : "data historis"})
              </p>
            )}

            <p className="text-secondary-400 mt-2 mb-0 text-xs">
              Berdasarkan {result.sampleSize} kejadian historis di wilayah ini. Ini adalah SARAN, bukan prediksi pasti.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccidentMapPage() {
  const [activeTab, setActiveTab] = useState<"peta" | "prediksi">("peta");
  const [points, setPoints] = useState<AccidentPointMarker[]>([]);
  const [clusters, setClusters] = useState<ClusterMarker[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (params: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const [pointsRes, clustersRes, regionsRes] = await Promise.all([
        fetch(`/api/accident-points${buildQuery(params)}`).then((r) => r.json()),
        fetch(`/api/accident-points/clusters${buildQuery(params)}`).then((r) => r.json()),
        fetch("/api/accident-points/regions").then((r) => r.json()),
      ]);

      if (!pointsRes.success) {
        setError(pointsRes.message ?? "Gagal memuat titik kecelakaan");
      } else {
        setPoints(pointsRes.data);
      }
      if (clustersRes.success) setClusters(clustersRes.data);
      if (regionsRes.success) setBranches(regionsRes.data.branches);
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadData({ branch, dateFrom, dateTo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    loadData({ branch, dateFrom, dateTo });
  }

  return (
    <AppShell pageTitle="Peta Data Kecelakaan" pageSubtitle="Visualisasi geospasial dan deteksi titik rawan">
      <div className="bg-warning-50 text-warning-700 border-warning-200 mb-4 rounded-lg border px-3.5 py-2.5 text-sm">
        <i className="ti ti-alert-triangle mr-1" />
        Data pada peta ini adalah <strong>data mock/dummy</strong> untuk keperluan pengembangan -
        belum berasal dari data resmi Korlantas Polri. Struktur data sudah disiapkan
        siap-integrasi; pengisian data real menunggu kerja sama data resmi antar-instansi.
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          className={`btn btn-sm ${activeTab === "peta" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setActiveTab("peta")}
        >
          <i className="ti ti-map mr-1" /> Peta
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === "prediksi" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setActiveTab("prediksi")}
        >
          <i className="ti ti-chart-radar mr-1" /> Prediksi Risiko
        </button>
      </div>

      {activeTab === "prediksi" && <RiskPredictionPanel branches={branches} />}

      {activeTab === "peta" && (
      <>
      <div className="card mb-6">
        <div className="card-body">
          <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="form-label">Dari tanggal</label>
              <input type="date" className="form-control" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Sampai tanggal</label>
              <input type="date" className="form-control" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Wilayah/Cabang</label>
              <select className="form-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">Semua wilayah</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Terapkan Filter</button>
            <span className="text-secondary-400 text-sm">
              {loading ? "Memuat..." : `${points.length} titik - ${clusters.length} titik rawan (klaster)`}
            </span>
          </form>

          {error && <p className="text-danger-600 mt-2 mb-0 text-sm">{error}</p>}

          {clusters.length > 0 && (
            <div className="mt-2 text-sm">
              <strong>Sinyal titik rawan:</strong>{" "}
              {clusters.slice(0, 5).map((c) => `${c.city ?? "?"} (${c.count} kejadian)`).join(", ")}
              {clusters.length > 5 && ` +${clusters.length - 5} lainnya`}
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-hidden p-0" style={{ height: "calc(100vh - 380px)", minHeight: 420 }}>
        <LeafletMap points={points} clusters={clusters} center={INDONESIA_CENTER} zoom={5} />
      </div>
      </>
      )}
    </AppShell>
  );
}
