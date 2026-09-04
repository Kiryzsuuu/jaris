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

type DamageAnalysis = { severity: string | null; confidence: number | null; description: string | null };

type AuditStep = { step: number; name: string; status: "ok" | "warning" | "skipped"; detail: string };
type AuditFlag = { severity: "info" | "warning" | "critical"; message: string };
type AuditResult = {
  steps: AuditStep[];
  documentFindings: { documentId: string; fileName: string; severity: string | null; description: string | null }[];
  flags: AuditFlag[];
  overallAssessment: string;
  recommendation: "lanjutkan" | "perlu_klarifikasi" | "tinjau_ulang";
};

const RECOMMENDATION_LABELS: Record<AuditResult["recommendation"], string> = {
  lanjutkan: "Lanjutkan",
  perlu_klarifikasi: "Perlu Klarifikasi",
  tinjau_ulang: "Tinjau Ulang",
};

const RECOMMENDATION_CLASSES: Record<AuditResult["recommendation"], string> = {
  lanjutkan: "bg-success-100 text-success-700",
  perlu_klarifikasi: "bg-warning-100 text-warning-700",
  tinjau_ulang: "bg-danger-100 text-danger-700",
};

const FLAG_CLASSES: Record<AuditFlag["severity"], string> = {
  info: "text-secondary-500",
  warning: "text-warning-600",
  critical: "text-danger-600",
};

const DOCUMENT_TYPES = [
  { value: "ktp_korban", label: "KTP Korban" },
  { value: "surat_keterangan_kecelakaan", label: "Surat Keterangan Kecelakaan (Kepolisian)" },
  { value: "akta_kematian", label: "Akta Kematian" },
  { value: "kartu_keluarga", label: "Kartu Keluarga" },
  { value: "surat_keterangan_dokter_cacat_tetap", label: "Surat Keterangan Dokter (Cacat Tetap)" },
  { value: "kwitansi_biaya_rawatan", label: "Kwitansi Biaya Perawatan" },
  { value: "kwitansi_biaya_penguburan", label: "Kwitansi Biaya Penguburan" },
  { value: "foto_kerusakan", label: "Foto Kerusakan (bisa dianalisis AI)" },
  { value: "lainnya", label: "Dokumen Lainnya" },
];

const SEVERITY_LABELS: Record<string, string> = {
  ringan: "Ringan",
  sedang: "Sedang",
  berat: "Berat",
};

function formatCurrency(amount: number | null) {
  if (amount === null) return "-";
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-secondary-400 block text-xs font-medium tracking-wide uppercase">{label}</span>
      <span className="mt-0.5 block text-sm text-[#1e293b]">{value}</span>
    </div>
  );
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

  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const [damageAnalysis, setDamageAnalysis] = useState<Record<string, DamageAnalysis>>({});

  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

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

  async function handleAnalyzeDamage(docId: string) {
    setAnalyzingDocId(docId);
    try {
      const res = await fetch(`/api/claims/${id}/documents/${docId}/analyze-damage`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setDamageAnalysis((prev) => ({ ...prev, [docId]: json.data }));
      } else {
        setDamageAnalysis((prev) => ({
          ...prev,
          [docId]: { severity: null, confidence: null, description: json.message },
        }));
      }
    } catch {
      setDamageAnalysis((prev) => ({
        ...prev,
        [docId]: { severity: null, confidence: null, description: "Tidak dapat menghubungi server" },
      }));
    } finally {
      setAnalyzingDocId(null);
    }
  }

  async function handleRunAudit() {
    setAuditRunning(true);
    setAuditError(null);
    try {
      const res = await fetch(`/api/claims/${id}/audit`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setAuditError(json.message ?? "Gagal menjalankan audit AI");
        return;
      }
      setAuditResult(json.data);
    } catch {
      setAuditError("Tidak dapat menghubungi server");
    } finally {
      setAuditRunning(false);
    }
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
        <p className="text-danger-600">{error ?? "Klaim tidak ditemukan"}</p>
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
      <div className="max-w-6xl">
        {actionMessage && <p className="text-secondary-400 mb-3 text-sm">{actionMessage}</p>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <div className="card">
              <div className="card-body">
                <h2 className="mb-4 text-base font-semibold text-[#1e293b]">Data Kecelakaan</h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <Field label="Tanggal" value={new Date(claim.accidentDate).toLocaleDateString("id-ID")} />
                  <Field label="Moda Transportasi" value={claim.transportMode} />
                  <Field label="Lokasi" value={claim.accidentLocation} />
                  <Field label="Klasifikasi Kasus" value={claim.caseCategory} />
                  {claim.disabilityPercentage !== null && <Field label="Persentase Cacat" value={`${claim.disabilityPercentage}%`} />}
                  {claim.claimedTreatmentCost !== null && (
                    <Field label="Biaya Klaim Perawatan" value={formatCurrency(claim.claimedTreatmentCost)} />
                  )}
                </div>
                <div className="border-secondary-100 mt-4 border-t pt-4">
                  <Field label="Deskripsi" value={claim.accidentDescription} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h2 className="mb-4 text-base font-semibold text-[#1e293b]">Korban / Penerima Santunan</h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <Field label="Nama" value={claim.claimant.fullName ?? "-"} />
                  <Field label="NIK" value={claim.claimant.nik ?? "-"} />
                  <Field label="Hubungan" value={claim.claimant.relationshipToVictim ?? "-"} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h2 className="mb-3 text-base font-semibold text-[#1e293b]">Dokumen Pendukung</h2>
                <ul className="space-y-2 text-sm">
                  {claim.documents.map((d) => {
                    const isImage = d.mimeType.startsWith("image/");
                    const analysis = damageAnalysis[d.id];
                    return (
                      <li key={d.id} className="border-secondary-200 border-b pb-2 last:border-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>{d.type} - {d.fileName}</span>
                          {isImage && (
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              disabled={analyzingDocId === d.id}
                              onClick={() => handleAnalyzeDamage(d.id)}
                            >
                              <i className="ti ti-camera mr-1" />
                              {analyzingDocId === d.id ? "Menganalisis..." : "Analisis Foto (AI)"}
                            </button>
                          )}
                        </div>
                        {analysis && (
                          <div className="bg-primary-50 mt-2 rounded-lg p-3 text-xs">
                            {analysis.severity ? (
                              <>
                                <strong>Saran AI:</strong> Tingkat kerusakan {SEVERITY_LABELS[analysis.severity] ?? analysis.severity}
                                {analysis.confidence !== null && ` (keyakinan ${(analysis.confidence * 100).toFixed(0)}%)`}
                                {analysis.description && <p className="mt-1">{analysis.description}</p>}
                                <p className="text-secondary-400 mt-1">Ini hanya saran - petugas tetap yang menilai final.</p>
                              </>
                            ) : (
                              <span className="text-warning-600">{analysis.description ?? "AI tidak memberikan hasil"}</span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {claim.documents.length === 0 && <li className="text-secondary-400">Belum ada dokumen</li>}
                </ul>

                {canUploadDoc && (
                  <form onSubmit={handleUpload} className="mt-4 flex flex-wrap items-end gap-3">
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
                    <button type="submit" disabled={busy || !docFile} className="btn btn-primary">
                      Unggah
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 self-start lg:sticky lg:top-6">
            {permissions.includes("claim:verify") && (
              <div className="card">
                <div className="card-body">
                  <h2 className="mb-1 text-base font-semibold text-[#1e293b]">Audit AI (Agentic)</h2>
                  <p className="text-secondary-400 mb-3 text-xs">
                    Memeriksa kelengkapan dokumen, menganalisis foto pendukung, lalu menyusun rekomendasi tinjauan.
                    Hanya saran - tidak pernah mengubah data klaim.
                  </p>

                  <button type="button" className="btn btn-outline-primary btn-sm" disabled={auditRunning} onClick={handleRunAudit}>
                    <i className="ti ti-robot mr-1" />
                    {auditRunning ? "Menjalankan audit..." : "Jalankan Audit AI"}
                  </button>

                  {auditError && <p className="text-danger-600 mt-2 text-sm">{auditError}</p>}

                  {auditResult && (
                    <div className="mt-4">
                      <ol className="space-y-1.5 text-xs">
                        {auditResult.steps.map((s) => (
                          <li key={s.step} className="flex items-start gap-2">
                            <i
                              className={`ti ${s.status === "ok" ? "ti-circle-check text-success-600" : s.status === "warning" ? "ti-alert-triangle text-warning-600" : "ti-circle-dashed text-secondary-400"} mt-0.5`}
                            />
                            <span><strong>{s.name}:</strong> {s.detail}</span>
                          </li>
                        ))}
                      </ol>

                      {auditResult.flags.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs">
                          {auditResult.flags.map((f, i) => (
                            <li key={i} className={FLAG_CLASSES[f.severity]}>
                              <i className="ti ti-point-filled mr-1" />
                              {f.message}
                            </li>
                          ))}
                        </ul>
                      )}

                      <p className="mt-3 text-sm">{auditResult.overallAssessment}</p>

                      <span className={`badge mt-2 ${RECOMMENDATION_CLASSES[auditResult.recommendation]}`}>
                        {RECOMMENDATION_LABELS[auditResult.recommendation]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-body">
                <h2 className="mb-4 text-base font-semibold text-[#1e293b]">Kalkulasi Santunan (Rules Engine)</h2>
                <div className="bg-primary-50 -mx-1 mb-3 grid grid-cols-2 gap-3 rounded-lg px-4 py-3">
                  <Field label="Estimasi" value={formatCurrency(claim.estimatedAmount)} />
                  <Field label="Disetujui" value={formatCurrency(claim.approvedAmount)} />
                </div>
                {claim.verification && (
                  <p className="text-secondary-400 text-sm">
                    Diverifikasi: {new Date(claim.verification.verifiedAt).toLocaleString("id-ID")}
                    {claim.verification.notes ? ` - ${claim.verification.notes}` : ""}
                  </p>
                )}
                {claim.approval && (
                  <p className="text-secondary-400 text-sm">
                    Disetujui: {new Date(claim.approval.approvedAt).toLocaleString("id-ID")}
                    {claim.approval.notes ? ` - ${claim.approval.notes}` : ""}
                  </p>
                )}
                {claim.rejection && (
                  <p className="text-danger-600 mb-0 text-sm">
                    Ditolak: {new Date(claim.rejection.rejectedAt).toLocaleString("id-ID")} - {claim.rejection.reason}
                  </p>
                )}
              </div>
            </div>

            {(canSubmit || canVerify || canApprove || canPay) && (
              <div className="card">
                <div className="card-body">
                  <h2 className="mb-3 text-base font-semibold text-[#1e293b]">Aksi</h2>

                  {canSubmit && (
                    <button disabled={busy} onClick={() => callAction(`/api/claims/${id}/submit`, {})} className="btn btn-primary mr-2 mb-2">
                      Ajukan Klaim (Submit)
                    </button>
                  )}

                  {canVerify && (
                    <>
                      <button disabled={busy} onClick={() => callAction(`/api/claims/${id}/verify`, { action: "verify" })} className="btn btn-primary mr-2 mb-2">
                        Verifikasi Lengkap
                      </button>
                      <RejectControl busy={busy} reason={reason} setReason={setReason} onReject={() => callAction(`/api/claims/${id}/verify`, { action: "reject", reason })} />
                    </>
                  )}

                  {canApprove && (
                    <>
                      <button disabled={busy} onClick={() => callAction(`/api/claims/${id}/approve`, { action: "approve" })} className="btn btn-primary mr-2 mb-2">
                        Setujui Klaim
                      </button>
                      <RejectControl busy={busy} reason={reason} setReason={setReason} onReject={() => callAction(`/api/claims/${id}/approve`, { action: "reject", reason })} />
                    </>
                  )}

                  {canPay && (
                    <button disabled={busy} onClick={() => callAction(`/api/claims/${id}/payment`, {})} className="btn btn-primary mb-2">
                      Catat Pencairan Santunan
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
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
    <span className="mb-2 inline-flex items-center gap-2">
      <input
        placeholder="Alasan penolakan"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="form-control text-sm"
      />
      <button
        disabled={busy || !reason}
        onClick={onReject}
        className="btn btn-outline-danger"
      >
        Tolak
      </button>
    </span>
  );
}
