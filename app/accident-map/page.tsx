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

export default function AccidentMapPage() {
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
      <div
        style={{
          fontSize: 13,
          color: "var(--sys-orange)",
          background: "var(--sys-orange-bg)",
          border: "1px solid var(--sys-orange)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 16,
        }}
      >
        <i className="bi bi-exclamation-triangle-fill me-1" />
        Data pada peta ini adalah <strong>data mock/dummy</strong> untuk keperluan pengembangan -
        belum berasal dari data resmi Korlantas Polri. Struktur data sudah disiapkan
        siap-integrasi; pengisian data real menunggu kerja sama data resmi antar-instansi.
      </div>

      <div className="card mb-4">
        <form onSubmit={applyFilters} className="d-flex gap-3 flex-wrap align-items-end">
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
          <button type="submit" className="btn btn-dark">Terapkan Filter</button>
          <span className="text-muted-green" style={{ fontSize: 13 }}>
            {loading ? "Memuat..." : `${points.length} titik - ${clusters.length} titik rawan (klaster)`}
          </span>
        </form>

        {error && <p className="text-danger mt-2 mb-0" style={{ fontSize: 13 }}>{error}</p>}

        {clusters.length > 0 && (
          <div className="mt-2" style={{ fontSize: 13 }}>
            <strong>Sinyal titik rawan:</strong>{" "}
            {clusters.slice(0, 5).map((c) => `${c.city ?? "?"} (${c.count} kejadian)`).join(", ")}
            {clusters.length > 5 && ` +${clusters.length - 5} lainnya`}
          </div>
        )}
      </div>

      <div className="card p-0" style={{ height: "calc(100vh - 380px)", minHeight: 420, overflow: "hidden" }}>
        <LeafletMap points={points} clusters={clusters} center={INDONESIA_CENTER} zoom={5} />
      </div>
    </AppShell>
  );
}
