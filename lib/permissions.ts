export const PERMISSIONS = {
  USER_MANAGE: "user:manage",
  USER_VIEW: "user:view",
  ROLE_MANAGE: "role:manage",
  ROLE_VIEW: "role:view",
  CLAIM_CREATE: "claim:create",
  CLAIM_VERIFY: "claim:verify",
  CLAIM_APPROVE: "claim:approve",
  CLAIM_VIEW: "claim:view",
  DASHBOARD_VIEW: "dashboard:view",
  AUDIT_VIEW: "audit:view",
  ASSISTANT_USE: "assistant:use",
  KB_MANAGE: "kb:manage",
  MAP_VIEW: "map:view",
  SETTINGS_MANAGE: "settings:manage",
  FRAUD_VIEW: "fraud:view",
  BROADCAST_MANAGE: "broadcast:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  [PERMISSIONS.USER_MANAGE]: "Membuat, mengubah, dan menonaktifkan akun pengguna & peran",
  [PERMISSIONS.USER_VIEW]: "Melihat daftar pengguna",
  [PERMISSIONS.ROLE_MANAGE]: "Mengubah daftar permission pada suatu peran",
  [PERMISSIONS.ROLE_VIEW]: "Melihat daftar peran & permission",
  [PERMISSIONS.CLAIM_CREATE]: "Membuat laporan klaim baru",
  [PERMISSIONS.CLAIM_VERIFY]: "Memverifikasi kelengkapan klaim",
  [PERMISSIONS.CLAIM_APPROVE]: "Menyetujui klaim & pencairan santunan",
  [PERMISSIONS.CLAIM_VIEW]: "Melihat data klaim",
  [PERMISSIONS.DASHBOARD_VIEW]: "Mengakses dashboard analitik",
  [PERMISSIONS.AUDIT_VIEW]: "Melihat audit log",
  [PERMISSIONS.ASSISTANT_USE]: "Menggunakan AI Asisten Internal (chat & saran klasifikasi)",
  [PERMISSIONS.KB_MANAGE]: "Mengelola dokumen knowledge base (ingest/hapus)",
  [PERMISSIONS.MAP_VIEW]: "Melihat peta data kecelakaan",
  [PERMISSIONS.SETTINGS_MANAGE]: "Mengubah pengaturan situs (nama, logo, warna tema)",
  [PERMISSIONS.FRAUD_VIEW]: "Melihat hasil deteksi anomali/potensi kecurangan klaim",
  [PERMISSIONS.BROADCAST_MANAGE]: "Mengirim pengumuman broadcast ke pengguna",
};

export const ROLE_SEEDS = [
  {
    name: "Petugas Lapangan",
    slug: "petugas-lapangan",
    description: "Mencatat laporan kecelakaan & mengajukan klaim dari lapangan",
    permissions: [
      PERMISSIONS.CLAIM_CREATE,
      PERMISSIONS.CLAIM_VIEW,
      PERMISSIONS.ASSISTANT_USE,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.MAP_VIEW,
    ],
  },
  {
    name: "Verifikator/Kepala Cabang",
    slug: "verifikator-kepala-cabang",
    description: "Memverifikasi kelengkapan klaim & menyetujui di tingkat cabang",
    permissions: [
      PERMISSIONS.CLAIM_VIEW,
      PERMISSIONS.CLAIM_VERIFY,
      PERMISSIONS.CLAIM_APPROVE,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ASSISTANT_USE,
      PERMISSIONS.MAP_VIEW,
      PERMISSIONS.FRAUD_VIEW,
    ],
  },
  {
    name: "Direksi/Manajemen",
    slug: "direksi-manajemen",
    description: "Visibilitas penuh atas operasional & laporan eksekutif",
    permissions: [
      PERMISSIONS.CLAIM_VIEW,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.ASSISTANT_USE,
      PERMISSIONS.MAP_VIEW,
      PERMISSIONS.FRAUD_VIEW,
      PERMISSIONS.BROADCAST_MANAGE,
    ],
  },
  {
    name: "Super Admin",
    slug: "super-admin",
    description: "Akses penuh, termasuk manajemen pengguna & peran",
    permissions: Object.values(PERMISSIONS),
  },
] as const;

export const ROLE_SLUGS = {
  PETUGAS_LAPANGAN: "petugas-lapangan",
  VERIFIKATOR_KEPALA_CABANG: "verifikator-kepala-cabang",
  DIREKSI_MANAJEMEN: "direksi-manajemen",
  SUPER_ADMIN: "super-admin",
} as const;
