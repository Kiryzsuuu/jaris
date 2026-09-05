export const CASE_CATEGORIES = [
  "meninggal_dunia",
  "cacat_tetap",
  "perawatan",
  "penguburan",
] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const CASE_CATEGORY_LABELS: Record<CaseCategory, string> = {
  meninggal_dunia: "Meninggal Dunia",
  cacat_tetap: "Cacat Tetap",
  perawatan: "Biaya Perawatan",
  penguburan: "Biaya Penguburan (tanpa ahli waris)",
};

export const TRANSPORT_MODES = ["darat_laut", "udara"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  darat_laut: "Darat / Laut",
  udara: "Udara",
};

export const CLAIM_STATUSES = [
  "draft",
  "submitted",
  "verified",
  "approved",
  "paid",
  "rejected",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// Only these transitions are allowed. Anything else is rejected by the API.
// submitted/verified -> draft ("Kembalikan") sends a claim back to the
// reporter for revision - distinct from "rejected", which is a final
// decision. A returned claim keeps its documents/data so the reporter only
// has to fix what was flagged, not start over.
export const CLAIM_STATUS_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  draft: ["submitted"],
  submitted: ["verified", "rejected", "draft"],
  verified: ["approved", "rejected", "draft"],
  approved: ["paid"],
  paid: [],
  rejected: [],
};

export function isValidStatusTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return CLAIM_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// Document types required per case category before verification can pass.
export const REQUIRED_DOCUMENTS: Record<CaseCategory, string[]> = {
  meninggal_dunia: [
    "ktp_korban",
    "surat_keterangan_kecelakaan",
    "akta_kematian",
    "kartu_keluarga",
  ],
  cacat_tetap: ["ktp_korban", "surat_keterangan_kecelakaan", "surat_keterangan_dokter_cacat_tetap"],
  perawatan: ["ktp_korban", "surat_keterangan_kecelakaan", "kwitansi_biaya_rawatan"],
  penguburan: ["surat_keterangan_kecelakaan", "akta_kematian", "kwitansi_biaya_penguburan"],
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  ktp_korban: "KTP Korban",
  surat_keterangan_kecelakaan: "Surat Keterangan Kecelakaan (Kepolisian)",
  akta_kematian: "Akta Kematian",
  kartu_keluarga: "Kartu Keluarga",
  surat_keterangan_dokter_cacat_tetap: "Surat Keterangan Dokter (Cacat Tetap)",
  kwitansi_biaya_rawatan: "Kwitansi Biaya Perawatan",
  kwitansi_biaya_penguburan: "Kwitansi Biaya Penguburan",
  lainnya: "Dokumen Lainnya",
};
