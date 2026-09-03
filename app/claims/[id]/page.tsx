"use client";

import { useCallback, useEffect, useState, use } from "react";
import AppShell from "@/components/AppShell";

type ClaimDetail = {
  id: string;
  claimNumber: string;
  status: string;
  reporterId: string;
  claimant: {
    fullName?: string;
    nik?: string;
    relationshipToVictim?: string;
    phone?: string;
    address?: string;
  };
  accidentDate: string;
  accidentLocation: string;
  accidentDescription: string;
  transportMode: string;
  caseCategory: string;
  disabilityPercentage: number | null;
  claimedTreatmentCost: number | null;
  documents: { id: string; type: string; fileName: string; mimeType: string; uploadedAt: string }[];
  estimatedAmount: number | null;
  approvedAmount: number | null;
  verification: { verifiedBy: string; verifiedAt: string; notes: string | null } | null;
  approval: { approvedBy: string; approvedAt: string; notes: string | null } | null;
  rejection: { rejectedBy: string; rejectedAt: string; reason: string } | null;
};

type Me = { id: string; permissions: string[] };

const DOCUMENT_TYPES = [
  { value: "ktp_korban", label: "KTP Korban" },
  { value: "surat_keterangan_kecelakaan", label: "Surat Keterangan Kecelakaan (Kepolisian)" },
  { value: "akta_kematian", label: "Akta Kematian" },
  { value: "kartu_keluarga", label: "Kartu Keluarga" },
  { value: "surat_keterangan_dokter_cacat_tetap", label: "Surat Keterangan Dokter (Cacat Tetap)" },
  { value: "kwitansi_biaya_rawatan", label: "Kwitansi Biaya Perawatan" },
  { value: "kwitansi_biaya_penguburan", label: "Kwitansi Biaya Penguburan" },
  { value: "lainnya", label: "Dokumen Lainnya" },
];

function formatCurrency(amount: number | null) {
  if (amount === null) return "-";
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [docType, setDocType] = useState("ktp_korban");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [claimRes, meRes] = await Promise.all([
        fetch(`/api/claims/${id}`).then((r) => r.json()),
        fetch("/api/auth/me").then((r) => r.json()),
      ]);
      if (!claimRes.success) {
        setError(claimRes.message ?? "Gagal memuat klaim");
      } else {
        setClaim(claimRes.data);
      }
      if (meRes.success) setMe(meRes.data);
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadData();
  }, [loadData]);

  async function callAction(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setActionMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setActionMessage(json.message ?? "Gagal memproses aksi");
        return;
      }
      setActionMessage(json.message ?? "Berhasil");
      await loadData();
    } catch {
      setActionMessage("Tidak dapat menghubungi server");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!docFile) return;
    const fileBase64 = await fileToBase64(docFile);
    await callAction(`/api/claims/${id}/documents`, {
      type: docType,
      fileName: docFile.name,
      mimeType: docFile.type || "application/octet-stream",
      fileBase64,
    });
    setDocFile(null);
  }

  if (loading) {
    return (
      <AppShell pageTitle="Detail Klaim">
        <p>Memuat...</p>
      </AppShell>
    );
  }
  if (error || !claim) {
    return (
      <AppShell pageTitle="Detail Klaim">
        <p className="text-danger">{error ?? "Klaim tidak ditemukan"}</p>
      </AppShell>
    );
  }

  const permissions = me?.permissions ?? [];
  const isOwner = me?.id === claim.reporterId;
  const canUploadDoc = isOwner && permissions.includes("claim:create") && ["draft", "submitted"].includes(claim.status);
  const canSubmit = isOwner && permissions.includes("claim:create") && claim.status === "draft";
  const canVerify = permissions.includes("claim:verify") && claim.status === "submitted";
  const canApprove = permissions.includes("claim:approve") && claim.status === "verified";
  const canPay = permissions.includes("claim:approve") && claim.status === "approved";

  return (
    <AppShell pageTitle={claim.claimNumber} pageSubtitle={`Status: ${claim.status}`}>
      <div style={{ maxWidth: 720 }}>
        {actionMessage && <p style={{ fontSize: 13 }} className="text-muted-green">{actionMessage}</p>}

        <div className="card mb-4">
          <h2 className="card-title mb-3">Data Kecelakaan</h2>
          <p><strong>Tanggal:</strong> {new Date(claim.accidentDate).toLocaleDateString("id-ID")}</p>
          <p><strong>Lokasi:</strong> {claim.accidentLocation}</p>
          <p><strong>Deskripsi:</strong> {claim.accidentDescription}</p>
          <p><strong>Moda transportasi:</strong> {claim.transportMode}</p>
          <p><strong>Klasifikasi kasus:</strong> {claim.caseCategory}</p>
          {claim.disabilityPercentage !== null && <p><strong>Persentase cacat:</strong> {claim.disabilityPercentage}%</p>}
          {claim.claimedTreatmentCost !== null && <p className="mb-0"><strong>Biaya klaim perawatan:</strong> {formatCurrency(claim.claimedTreatmentCost)}</p>}
        </div>

        <div className="card mb-4">
          <h2 className="card-title mb-3">Korban / Penerima Santunan</h2>
          <p><strong>Nama:</strong> {claim.claimant.fullName}</p>
          <p><strong>NIK:</strong> {claim.claimant.nik}</p>
          <p className="mb-0"><strong>Hubungan:</strong> {claim.claimant.relationshipToVictim}</p>
        </div>

        <div className="card mb-4">
          <h2 className="card-title mb-3">Kalkulasi Santunan (Rules Engine)</h2>
          <p><strong>Estimasi:</strong> {formatCurrency(claim.estimatedAmount)}</p>
          <p><strong>Disetujui:</strong> {formatCurrency(claim.approvedAmount)}</p>
          {claim.verification && (
            <p style={{ fontSize: 13 }} className="text-muted-green">
              Diverifikasi: {new Date(claim.verification.verifiedAt).toLocaleString("id-ID")}
              {claim.verification.notes ? ` - ${claim.verification.notes}` : ""}
            </p>
          )}
          {claim.approval && (
            <p style={{ fontSize: 13 }} className="text-muted-green">
              Disetujui: {new Date(claim.approval.approvedAt).toLocaleString("id-ID")}
              {claim.approval.notes ? ` - ${claim.approval.notes}` : ""}
            </p>
          )}
          {claim.rejection && (
            <p style={{ fontSize: 13 }} className="text-danger mb-0">
              Ditolak: {new Date(claim.rejection.rejectedAt).toLocaleString("id-ID")} - {claim.rejection.reason}
            </p>
          )}
        </div>

        <div className="card mb-4">
          <h2 className="card-title mb-3">Dokumen Pendukung</h2>
          <ul style={{ paddingLeft: 18, fontSize: 14 }}>
            {claim.documents.map((d) => (
              <li key={d.id}>{d.type} - {d.fileName}</li>
            ))}
            {claim.documents.length === 0 && <li className="text-muted-green">Belum ada dokumen</li>}
          </ul>

          {canUploadDoc && (
            <form onSubmit={handleUpload} className="d-flex gap-2 align-items-end flex-wrap mt-2">
              <div>
                <label className="form-label">Jenis dokumen</label>
                <select className="form-select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">File</label>
                <input
                  type="file"
                  required
                  className="form-control"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <button type="submit" disabled={busy || !docFile} className="btn btn-dark">
                Unggah
              </button>
            </form>
          )}
        </div>

        {(canSubmit || canVerify || canApprove || canPay) && (
          <div className="card">
            <h2 className="card-title mb-3">Aksi</h2>

            {canSubmit && (
              <button disabled={busy} onClick={() => callAction(`/api/claims/${id}/submit`, {})} className="btn btn-dark me-2 mb-2">
                Ajukan Klaim (Submit)
              </button>
            )}

            {canVerify && (
              <>
                <button disabled={busy} onClick={() => callAction(`/api/claims/${id}/verify`, { action: "verify" })} className="btn btn-dark me-2 mb-2">
                  Verifikasi Lengkap
                </button>
                <RejectControl busy={busy} reason={reason} setReason={setReason} onReject={() => callAction(`/api/claims/${id}/verify`, { action: "reject", reason })} />
              </>
            )}

            {canApprove && (
              <>
                <button disabled={busy} onClick={() => callAction(`/api/claims/${id}/approve`, { action: "approve" })} className="btn btn-dark me-2 mb-2">
                  Setujui Klaim
                </button>
                <RejectControl busy={busy} reason={reason} setReason={setReason} onReject={() => callAction(`/api/claims/${id}/approve`, { action: "reject", reason })} />
              </>
            )}

            {canPay && (
              <button disabled={busy} onClick={() => callAction(`/api/claims/${id}/payment`, {})} className="btn btn-dark mb-2">
                Catat Pencairan Santunan
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function RejectControl({
  busy,
  reason,
  setReason,
  onReject,
}: {
  busy: boolean;
  reason: string;
  setReason: (v: string) => void;
  onReject: () => void;
}) {
  return (
    <span className="d-inline-flex gap-2 align-items-center mb-2">
      <input
        placeholder="Alasan penolakan"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="form-control"
        style={{ fontSize: 13 }}
      />
      <button
        disabled={busy || !reason}
        onClick={onReject}
        className="btn"
        style={{ background: "white", color: "var(--sys-red)", border: "1px solid var(--sys-red)" }}
      >
        Tolak
      </button>
    </span>
  );
}
