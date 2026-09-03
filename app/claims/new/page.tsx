"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

const CASE_CATEGORIES = [
  { value: "meninggal_dunia", label: "Meninggal Dunia" },
  { value: "cacat_tetap", label: "Cacat Tetap" },
  { value: "perawatan", label: "Biaya Perawatan" },
  { value: "penguburan", label: "Biaya Penguburan (tanpa ahli waris)" },
];

const TRANSPORT_MODES = [
  { value: "darat_laut", label: "Darat / Laut" },
  { value: "udara", label: "Udara" },
];

export default function NewClaimPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    category: string | null;
    confidence: number | null;
    reasoning: string | null;
  } | null>(null);

  const [form, setForm] = useState({
    accidentDate: "",
    accidentLocation: "",
    accidentDescription: "",
    transportMode: "darat_laut",
    caseCategory: "meninggal_dunia",
    disabilityPercentage: "",
    claimedTreatmentCost: "",
    claimant: {
      fullName: "",
      nik: "",
      relationshipToVictim: "",
      phone: "",
      address: "",
      bankName: "",
      bankAccountNumber: "",
      bankAccountHolder: "",
    },
  });

  function setClaimantField(field: string, value: string) {
    setForm((f) => ({ ...f, claimant: { ...f.claimant, [field]: value } }));
  }

  async function handleSuggestCategory() {
    if (!form.accidentDescription.trim()) {
      setSuggestion({ category: null, confidence: null, reasoning: "Isi deskripsi kejadian terlebih dahulu." });
      return;
    }
    setSuggesting(true);
    setSuggestion(null);
    try {
      const res = await fetch("/api/assistant/classify-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: form.accidentDescription }),
      });
      const json = await res.json();
      if (!json.success) {
        setSuggestion({ category: null, confidence: null, reasoning: json.message });
        return;
      }
      setSuggestion({
        category: json.data.suggestedCategory,
        confidence: json.data.confidence,
        reasoning: json.data.reasoning,
      });
    } catch {
      setSuggestion({ category: null, confidence: null, reasoning: "Tidak dapat menghubungi AI Asisten" });
    } finally {
      setSuggesting(false);
    }
  }

  function applySuggestion() {
    if (suggestion?.category) {
      setForm((f) => ({ ...f, caseCategory: suggestion.category! }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        accidentDate: form.accidentDate,
        accidentLocation: form.accidentLocation,
        accidentDescription: form.accidentDescription,
        transportMode: form.transportMode,
        caseCategory: form.caseCategory,
        claimant: form.claimant,
      };
      if (form.caseCategory === "cacat_tetap") {
        payload.disabilityPercentage = Number(form.disabilityPercentage);
      }
      if (form.caseCategory === "perawatan") {
        payload.claimedTreatmentCost = Number(form.claimedTreatmentCost);
      }

      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message ?? "Gagal membuat laporan klaim");
        return;
      }

      router.push(`/claims/${json.data.id}`);
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      pageTitle="Laporan Kecelakaan Baru"
      pageSubtitle="AI Asisten hanya memberi SARAN klasifikasi - petugas wajib mengonfirmasi kategori final"
    >
      <form onSubmit={handleSubmit} className="max-w-5xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card self-start">
            <div className="card-body">
              <h2 className="mb-4 text-base font-semibold text-[#1d2630]">Data Kecelakaan</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Tanggal kecelakaan</label>
                  <input
                    type="date"
                    required
                    className="form-control"
                    value={form.accidentDate}
                    onChange={(e) => setForm((f) => ({ ...f, accidentDate: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="form-label">Lokasi</label>
                  <input
                    required
                    className="form-control"
                    value={form.accidentLocation}
                    onChange={(e) => setForm((f) => ({ ...f, accidentLocation: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="form-label">Deskripsi kejadian</label>
                <textarea
                  required
                  rows={3}
                  className="form-control"
                  value={form.accidentDescription}
                  onChange={(e) => setForm((f) => ({ ...f, accidentDescription: e.target.value }))}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Moda transportasi</label>
                  <select
                    className="form-select"
                    value={form.transportMode}
                    onChange={(e) => setForm((f) => ({ ...f, transportMode: e.target.value }))}
                  >
                    {TRANSPORT_MODES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Klasifikasi kasus (konfirmasi petugas)</label>
                  <select
                    className="form-select"
                    value={form.caseCategory}
                    onChange={(e) => setForm((f) => ({ ...f, caseCategory: e.target.value }))}
                  >
                    {CASE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={handleSuggestCategory}
                  disabled={suggesting}
                >
                  <i className="ti ti-sparkles mr-1" />
                  {suggesting ? "Meminta saran AI..." : "Sarankan kategori (AI)"}
                </button>

                {suggestion && (
                  <div className="mt-2 text-sm">
                    {suggestion.category ? (
                      <>
                        Saran AI: <strong>{CASE_CATEGORIES.find((c) => c.value === suggestion.category)?.label}</strong>
                        {suggestion.confidence !== null && ` (keyakinan ${(suggestion.confidence * 100).toFixed(0)}%)`}
                        {suggestion.reasoning && <> - {suggestion.reasoning}</>}
                        <button
                          type="button"
                          onClick={applySuggestion}
                          className="text-primary-600 ml-2 font-semibold"
                        >
                          Gunakan
                        </button>
                      </>
                    ) : (
                      <span className="text-warning-600">{suggestion.reasoning ?? "AI tidak memberikan saran"}</span>
                    )}
                  </div>
                )}
              </div>

              {form.caseCategory === "cacat_tetap" && (
                <div className="mt-4">
                  <label className="form-label">Persentase cacat tetap (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    className="form-control"
                    value={form.disabilityPercentage}
                    onChange={(e) => setForm((f) => ({ ...f, disabilityPercentage: e.target.value }))}
                  />
                </div>
              )}

              {form.caseCategory === "perawatan" && (
                <div className="mt-4">
                  <label className="form-label">Biaya perawatan yang diklaim (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    className="form-control"
                    value={form.claimedTreatmentCost}
                    onChange={(e) => setForm((f) => ({ ...f, claimedTreatmentCost: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="card self-start">
            <div className="card-body">
              <h2 className="mb-4 text-base font-semibold text-[#1d2630]">Data Korban / Penerima Santunan</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Nama lengkap</label>
                  <input
                    required
                    className="form-control"
                    value={form.claimant.fullName}
                    onChange={(e) => setClaimantField("fullName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">NIK</label>
                  <input
                    required
                    className="form-control"
                    value={form.claimant.nik}
                    onChange={(e) => setClaimantField("nik", e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Hubungan dengan korban</label>
                  <input
                    required
                    placeholder="mis. Diri sendiri / Ahli waris (istri)"
                    className="form-control"
                    value={form.claimant.relationshipToVictim}
                    onChange={(e) => setClaimantField("relationshipToVictim", e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">No. telepon</label>
                  <input
                    className="form-control"
                    value={form.claimant.phone}
                    onChange={(e) => setClaimantField("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="form-label">Alamat</label>
                <input
                  className="form-control"
                  value={form.claimant.address}
                  onChange={(e) => setClaimantField("address", e.target.value)}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="form-label">Nama bank</label>
                  <input
                    className="form-control"
                    value={form.claimant.bankName}
                    onChange={(e) => setClaimantField("bankName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">No. rekening</label>
                  <input
                    className="form-control"
                    value={form.claimant.bankAccountNumber}
                    onChange={(e) => setClaimantField("bankAccountNumber", e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Nama pemilik rekening</label>
                  <input
                    className="form-control"
                    value={form.claimant.bankAccountHolder}
                    onChange={(e) => setClaimantField("bankAccountHolder", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-danger-600 mt-4 mb-3 text-sm">{error}</p>}

        <button type="submit" className="btn btn-primary mt-2" disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan sebagai Draft"}
        </button>
      </form>
    </AppShell>
  );
}
