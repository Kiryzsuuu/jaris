export function welcomeEmail(params: { name: string; email: string; password: string; roleName: string }) {
  const subject = "Akun JARIS Anda telah dibuat";
  const text = [
    `Halo ${params.name},`,
    "",
    "Akun Anda untuk JARIS (Sistem Informasi Jasa Raharja) telah dibuat oleh admin.",
    "",
    `Email: ${params.email}`,
    `Password sementara: ${params.password}`,
    `Peran: ${params.roleName}`,
    "",
    "Segera login dan disarankan untuk tidak membagikan kredensial ini kepada siapa pun.",
    "",
    "Email ini dikirim otomatis, mohon tidak membalas.",
  ].join("\n");

  return { subject, text };
}

export function claimStatusEmail(params: {
  reporterName: string;
  claimNumber: string;
  status: string;
  note?: string;
}) {
  const statusLabels: Record<string, string> = {
    verified: "diverifikasi",
    approved: "disetujui",
    rejected: "ditolak",
    paid: "santunan telah dicairkan",
  };
  const statusLabel = statusLabels[params.status] ?? params.status;

  const subject = `Update klaim ${params.claimNumber}: ${statusLabel}`;
  const text = [
    `Halo ${params.reporterName},`,
    "",
    `Status klaim ${params.claimNumber} telah berubah menjadi: ${statusLabel}.`,
    params.note ? `Catatan: ${params.note}` : "",
    "",
    "Silakan login ke JARIS untuk melihat detail lengkap.",
    "",
    "Email ini dikirim otomatis, mohon tidak membalas.",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, text };
}
