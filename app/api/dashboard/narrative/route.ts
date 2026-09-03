import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { parseDashboardFilters } from "@/lib/dashboardFilters";
import { getDashboardSummary } from "@/lib/dashboardStats";
import { groqChatCompletion, GroqError } from "@/lib/groqClient";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatRupiah(amount: number) {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

/**
 * Generates an executive-summary narrative from already-computed aggregate
 * numbers only - never raw claim/claimant records - per PRD §3.2/§4:
 * generative AI narrates real figures, it does not compute or invent them.
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.DASHBOARD_VIEW);

    const filters = parseDashboardFilters(request, session);
    const summary = await getDashboardSummary(filters);

    const statusLines = summary.claimsByStatus
      .map((s) => `- ${s.status}: ${s.count} klaim`)
      .join("\n");

    const branchLines = summary.paymentsByBranch.length
      ? summary.paymentsByBranch
          .map((b) => `- ${b.branch}: ${formatRupiah(b.totalPaid)} (${b.paymentCount} pencairan)`)
          .join("\n")
      : "- (belum ada data pencairan santunan pada periode/filter ini)";

    const trendLines = summary.monthlyAccidentTrend.length
      ? summary.monthlyAccidentTrend
          .map((t) => `- ${MONTH_NAMES[t.month - 1]} ${t.year}: ${t.count} laporan kecelakaan`)
          .join("\n")
      : "- (belum ada data laporan kecelakaan pada periode/filter ini)";

    const dataBlock = [
      `Total klaim (sesuai filter): ${summary.totalClaims}`,
      `Total realisasi santunan (sesuai filter): ${formatRupiah(summary.totalPaidAmount)}`,
      "",
      "Jumlah klaim per status:",
      statusLines,
      "",
      "Realisasi santunan per wilayah/cabang:",
      branchLines,
      "",
      "Tren laporan kecelakaan per bulan:",
      trendLines,
      "",
      `Rata-rata waktu penyelesaian (submitted → paid): ${
        summary.resolution.avgResolutionDays !== null
          ? `${summary.resolution.avgResolutionDays} hari (dari ${summary.resolution.sampleSize} klaim lunas)`
          : "belum ada sampel klaim lunas yang cukup"
      }`,
    ].join("\n");

    const systemPrompt = [
      "Anda adalah asisten yang menulis ringkasan eksekutif untuk manajemen PT Jasa Raharja (Persero).",
      "Gunakan HANYA angka-angka pada data agregat di bawah ini. JANGAN mengarang angka, tren, atau kesimpulan yang tidak didukung data tersebut.",
      "Tulis 3-5 kalimat naratif dalam Bahasa Indonesia formal, singkat dan padat, menonjolkan hal yang paling signifikan (status yang menumpuk, cabang dengan realisasi terbesar, tren naik/turun, kecepatan penyelesaian).",
      "Jangan memberi rekomendasi keputusan pencairan dana - ini hanya ringkasan informasi, bukan otorisasi.",
      "",
      "=== DATA AGREGAT ===",
      dataBlock,
    ].join("\n");

    let narrative: string;
    try {
      narrative = await groqChatCompletion([
        { role: "system", content: systemPrompt },
        { role: "user", content: "Buatkan ringkasan eksekutifnya." },
      ]);
    } catch (error) {
      if (error instanceof GroqError) {
        return errorResponse(`AI Asisten tidak tersedia: ${error.message}`, 502);
      }
      throw error;
    }

    return successResponse(
      { narrative, generatedFrom: { totalClaims: summary.totalClaims, totalPaidAmount: summary.totalPaidAmount } },
      "Ringkasan eksekutif berhasil dibuat"
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

