import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { connectToDatabase } from "@/lib/mongodb";
import { errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { parseDashboardFilters } from "@/lib/dashboardFilters";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboardStats";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function formatRupiah(amount: number) {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.DASHBOARD_VIEW);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    if (format !== "pdf" && format !== "excel") {
      return errorResponse("format wajib 'pdf' atau 'excel'", 400);
    }

    const filters = parseDashboardFilters(request, session);
    const summary = await getDashboardSummary(filters);

    if (format === "excel") {
      const buffer = await buildExcelReport(summary);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="jaris-dashboard-${Date.now()}.xlsx"`,
        },
      });
    }

    const buffer = await buildPdfReport(summary);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="jaris-dashboard-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

async function buildExcelReport(summary: DashboardSummary): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JARIS";
  workbook.created = new Date();

  const overview = workbook.addWorksheet("Ringkasan");
  overview.columns = [{ width: 32 }, { width: 24 }];
  overview.addRow(["Total Klaim", summary.totalClaims]);
  overview.addRow(["Total Realisasi Santunan", summary.totalPaidAmount]);
  overview.addRow([
    "Rata-rata Penyelesaian (hari)",
    summary.resolution.avgResolutionDays ?? "N/A",
  ]);
  overview.addRow(["Sampel Klaim Lunas", summary.resolution.sampleSize]);
  overview.getRow(1).font = { bold: true };

  const byStatus = workbook.addWorksheet("Klaim per Status");
  byStatus.columns = [
    { header: "Status", key: "status", width: 20 },
    { header: "Jumlah", key: "count", width: 12 },
  ];
  byStatus.addRows(summary.claimsByStatus);
  byStatus.getRow(1).font = { bold: true };

  const byBranch = workbook.addWorksheet("Realisasi per Cabang");
  byBranch.columns = [
    { header: "Cabang", key: "branch", width: 28 },
    { header: "Total Santunan (Rp)", key: "totalPaid", width: 22 },
    { header: "Jumlah Pencairan", key: "paymentCount", width: 18 },
  ];
  byBranch.addRows(summary.paymentsByBranch);
  byBranch.getRow(1).font = { bold: true };

  const trend = workbook.addWorksheet("Tren Bulanan");
  trend.columns = [
    { header: "Tahun", key: "year", width: 10 },
    { header: "Bulan", key: "month", width: 12 },
    { header: "Jumlah Kecelakaan", key: "count", width: 20 },
  ];
  trend.addRows(
    summary.monthlyAccidentTrend.map((t) => ({
      year: t.year,
      month: MONTH_NAMES[t.month - 1],
      count: t.count,
    }))
  );
  trend.getRow(1).font = { bold: true };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

async function buildPdfReport(summary: DashboardSummary): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(18).text("JARIS - Laporan Dashboard Analitik", { align: "left" });
  doc.fontSize(10).fillColor("#6b7280").text(`Dibuat: ${new Date().toLocaleString("id-ID")}`);
  doc.moveDown(1.5);

  doc.fillColor("#111827").fontSize(13).text("Ringkasan");
  doc.fontSize(10);
  doc.text(`Total Klaim: ${summary.totalClaims}`);
  doc.text(`Total Realisasi Santunan: ${formatRupiah(summary.totalPaidAmount)}`);
  doc.text(
    `Rata-rata Waktu Penyelesaian: ${
      summary.resolution.avgResolutionDays !== null
        ? `${summary.resolution.avgResolutionDays} hari (${summary.resolution.sampleSize} klaim lunas)`
        : "N/A"
    }`
  );
  doc.moveDown(1);

  doc.fontSize(13).text("Klaim per Status");
  doc.fontSize(10);
  summary.claimsByStatus.forEach((s) => doc.text(`${s.status}: ${s.count} klaim`));
  doc.moveDown(1);

  doc.fontSize(13).text("Realisasi Santunan per Wilayah/Cabang");
  doc.fontSize(10);
  if (summary.paymentsByBranch.length === 0) {
    doc.text("(belum ada data)");
  } else {
    summary.paymentsByBranch.forEach((b) =>
      doc.text(`${b.branch}: ${formatRupiah(b.totalPaid)} (${b.paymentCount} pencairan)`)
    );
  }
  doc.moveDown(1);

  doc.fontSize(13).text("Tren Kecelakaan Bulanan");
  doc.fontSize(10);
  if (summary.monthlyAccidentTrend.length === 0) {
    doc.text("(belum ada data)");
  } else {
    summary.monthlyAccidentTrend.forEach((t) =>
      doc.text(`${MONTH_NAMES[t.month - 1]} ${t.year}: ${t.count} laporan`)
    );
  }

  doc.end();
  return done;
}
