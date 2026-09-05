import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { connectToDatabase } from "@/lib/mongodb";
import { errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { CASE_CATEGORY_LABELS, type CaseCategory } from "@/lib/claimTypes";
import { SIGNAL_LABELS } from "@/lib/fraudDetectionAgent";
import { runFraudDetectionScan } from "@/lib/fraudDetectionAgent";
import Claim from "@/models/Claim";
import Claimant from "@/models/Claimant";

type Params = { params: Promise<{ claimId: string }> };

// Generates a PDF investigation-report document for one flagged claim - the
// "Buat Laporan" action. Pulls the same deterministic signals/AI narrative
// as the fraud-detection scan, formatted for printing/filing, not a new
// analysis. Advisory only - explicitly labeled as such in the document.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.FRAUD_VIEW);
    const { claimId } = await params;

    const claim = await Claim.findById(claimId);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);
    const claimant = await Claimant.findById(claim.claimantId);

    // Re-run the scan scoped for a narrative on this claim specifically -
    // cheap since it's one Groq call regardless of claim count.
    const scan = await runFraudDetectionScan(50, { withNarrative: true });
    const finding = scan.findings.find((f) => f.claimId === claimId);

    const buffer = await buildReportPdf({
      claimNumber: claim.claimNumber,
      claimantName: claimant?.fullName ?? "-",
      caseCategory: CASE_CATEGORY_LABELS[claim.caseCategory as CaseCategory],
      finding,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="investigasi-${claim.claimNumber}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

async function buildReportPdf(params: {
  claimNumber: string;
  claimantName: string;
  caseCategory: string;
  finding: Awaited<ReturnType<typeof runFraudDetectionScan>>["findings"][number] | undefined;
}): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(18).fillColor("#0B2D6B").text("JARIS - Laporan Investigasi Anomali Klaim");
  doc.fontSize(10).fillColor("#6b7280").text(`Dibuat: ${new Date().toLocaleString("id-ID")}`);
  doc.moveDown(1.5);

  doc.fillColor("#111827").fontSize(13).text("Data Klaim");
  doc.fontSize(10);
  doc.text(`Nomor Klaim: ${params.claimNumber}`);
  doc.text(`Penerima Santunan: ${params.claimantName}`);
  doc.text(`Kategori Kasus: ${params.caseCategory}`);
  doc.moveDown(1);

  if (!params.finding) {
    doc.fontSize(13).text("Status");
    doc.fontSize(10).text("Klaim ini tidak (lagi) ditandai oleh pemindaian anomali saat laporan dibuat.");
    doc.end();
    return done;
  }

  doc.fontSize(13).text(`Skor Risiko: ${params.finding.riskScore} / 100 (${params.finding.riskTier.toUpperCase()})`);
  doc.moveDown(0.5);

  doc.fontSize(13).text("Sinyal Anomali Terdeteksi");
  doc.fontSize(10);
  for (const s of params.finding.signalBreakdown) {
    doc.text(`- ${SIGNAL_LABELS[s.signal]}: ${s.detail} (+${s.points} poin)`);
  }
  doc.moveDown(1);

  if (params.finding.aiFinding) {
    doc.fontSize(13).text("Temuan Utama (AI)");
    doc.fontSize(10).text(params.finding.aiFinding);
    doc.moveDown(1);
  }

  if (params.finding.aiRecommendation) {
    doc.fontSize(13).text("Rekomendasi (AI)");
    doc.fontSize(10).text(params.finding.aiRecommendation);
    doc.moveDown(1);
  }

  doc.fontSize(9).fillColor("#6b7280").text(
    "Catatan: Laporan ini bersifat SARAN untuk investigasi lebih lanjut, dihasilkan dari analisis statistik dan AI. Bukan tuduhan atau keputusan final - keputusan akhir tetap berada pada petugas berwenang."
  );

  doc.end();
  return done;
}
