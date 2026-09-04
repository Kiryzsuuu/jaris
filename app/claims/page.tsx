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

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-secondary-100 text-secondary-700",
  submitted: "bg-primary-100 text-primary-700",
  verified: "bg-warning-100 text-warning-700",
  approved: "bg-info-100 text-info-700",
  paid: "bg-success-100 text-success-700",
  rejected: "bg-danger-100 text-danger-700",
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
          <Link href="/claims/new" className="btn btn-primary">
            <i className="ti ti-plus mr-1" /> Laporan Baru
          </Link>
        ) : undefined
      }
    >
      <div className="card">
        <div className="card-body">
          <label className="mb-3 block text-sm">
            Filter status:{" "}
            <select
              className="form-select mt-1 inline-block w-auto"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Semua</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          {loading && <p>Memuat...</p>}
          {error && <p className="text-danger-600">{error}</p>}

          {!loading && !error && (
            <div className="table-responsive">
              <table className="table w-full">
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
                        <Link href={`/claims/${c.id}`} className="text-primary-600 font-semibold">
                          {c.claimNumber}
                        </Link>
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="bg-dark-500 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                            {(c.claimant?.fullName ?? "?").slice(0, 1).toUpperCase()}
                          </span>
                          {c.claimant?.fullName ?? "-"}
                        </div>
                      </td>
                      <td>{c.caseCategory}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[c.status] ?? STATUS_BADGE.draft}`}>
                          {c.status}
                        </span>
                      </td>
                      <td>{formatCurrency(c.estimatedAmount)}</td>
                      <td>{formatCurrency(c.approvedAmount)}</td>
                    </tr>
                  ))}
                  {claims.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-secondary-400 py-4 text-center">
                        Tidak ada klaim
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
