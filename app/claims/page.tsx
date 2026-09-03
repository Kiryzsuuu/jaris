"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

type ClaimRow = {
  id: string;
  claimNumber: string;
  status: string;
  caseCategory: string;
  transportMode: string;
  estimatedAmount: number | null;
  approvedAmount: number | null;
  claimant: { fullName?: string };
  createdAt: string;
};

const STATUS_OPTIONS = ["draft", "submitted", "verified", "approved", "paid", "rejected"];

const STATUS_BADGE: Record<string, "success" | "pending" | "failed"> = {
  draft: "pending",
  submitted: "pending",
  verified: "pending",
  approved: "success",
  paid: "success",
  rejected: "failed",
};

function formatCurrency(amount: number | null) {
  if (amount === null) return "-";
  return `Rp${amount.toLocaleString("id-ID")}`;
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);

  const loadData = useCallback(async (statusFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter ? `/api/claims?status=${statusFilter}` : "/api/claims";
      const [claimsRes, meRes] = await Promise.all([
        fetch(url).then((r) => r.json()),
        fetch("/api/auth/me").then((r) => r.json()),
      ]);

      if (!claimsRes.success) {
        setError(claimsRes.message ?? "Gagal memuat klaim");
      } else {
        setClaims(claimsRes.data);
      }
      if (meRes.success) {
        setCanCreate(meRes.data.permissions.includes("claim:create"));
      }
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount / filter change
    loadData(status);
  }, [loadData, status]);

  return (
    <AppShell
      pageTitle="Manajemen Klaim"
      pageSubtitle="Siklus hidup klaim dan santunan Jasa Raharja"
      headerActions={
        canCreate ? (
          <Link href="/claims/new" className="btn btn-dark">
            <i className="bi bi-plus-lg me-1" /> Laporan Baru
          </Link>
        ) : undefined
      }
    >
      <div className="card">
        <div className="table-header-control mb-3">
          <label style={{ fontSize: 13 }}>
            Filter status:{" "}
            <select
              className="form-select d-inline-block"
              style={{ width: "auto" }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Semua</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        {loading && <p>Memuat...</p>}
        {error && <p className="text-danger">{error}</p>}

        {!loading && !error && (
          <div className="table-responsive">
            <table className="table-custom w-100">
              <thead>
                <tr>
                  <th>No. Klaim</th>
                  <th>Korban/Penerima</th>
                  <th>Kategori</th>
                  <th>Status</th>
                  <th>Estimasi</th>
                  <th>Disetujui</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/claims/${c.id}`} className="fw-semibold">
                        {c.claimNumber}
                      </Link>
                    </td>
                    <td>{c.claimant?.fullName ?? "-"}</td>
                    <td>{c.caseCategory}</td>
                    <td>
                      <span className={`badge-table ${STATUS_BADGE[c.status] ?? "pending"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>{formatCurrency(c.estimatedAmount)}</td>
                    <td>{formatCurrency(c.approvedAmount)}</td>
                  </tr>
                ))}
                {claims.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, textAlign: "center" }} className="text-muted-green">
                      Tidak ada klaim
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
