import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { connectToDatabase } from "@/lib/mongodb";
import { errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { canAccessClaim } from "@/lib/claimAccess";
import { CASE_CATEGORY_LABELS, TRANSPORT_MODE_LABELS, type CaseCategory, type TransportMode } from "@/lib/claimTypes";
import { serializeClaim } from "@/lib/claimSerializer";
import Claim from "@/models/Claim";
import Claimant from "@/models/Claimant";

type Params = { params: Promise<{ id: string }> };

function formatCurrency(amount: number | null) {
  if (amount === null) return "-";
  return `Rp${amount.toLocaleString("id-ID")}`;
}

// Prints the claim detail as a PDF - the "Download" button on the claim
// detail page. Read-only summary of already-stored data, no recalculation.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_VIEW);
    const { id } = await params;

    const claim = await Claim.findById(id);
    if (!claim) return errorResponse("Klaim tidak ditemukan", 404);
    if (!canAccessClaim(session, claim.reporterId.toString())) {
      return errorResponse("Akses ditolak: bukan klaim milik Anda", 403);
    }

    const claimant = await Claimant.findById(claim.claimantId);
    const data = serializeClaim(claim, claimant);

    const buffer = await buildClaimPdf(data);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="klaim-${data.claimNumber}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

async function buildClaimPdf(claim: ReturnType<typeof serializeClaim>): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(18).fillColor("#0B2D6B").text("JARIS - Ringkasan Klaim");
  doc.fontSize(10).fillColor("#6b7280").text(`Dicetak: ${new Date().toLocaleString("id-ID")}`);
  doc.moveDown(1.5);

  doc.fillColor("#111827").fontSize(14).text(`${claim.claimNumber} - ${claim.status.toUpperCase()}`);
  doc.moveDown(0.5);

  doc.fontSize(12).text("Data Kecelakaan");
  doc.fontSize(10);
  doc.text(`Tanggal: ${new Date(claim.accidentDate).toLocaleDateString("id-ID")}`);
  doc.text(`Lokasi: ${claim.accidentLocation}`);
  if (claim.vehiclePlateNumber) doc.text(`No. Polisi Kendaraan: ${claim.vehiclePlateNumber}`);
  doc.text(`Moda Transportasi: ${TRANSPORT_MODE_LABELS[claim.transportMode as TransportMode]}`);
  doc.text(`Klasifikasi Kasus: ${CASE_CATEGORY_LABELS[claim.caseCategory as CaseCategory]}`);
  doc.text(`Deskripsi: ${claim.accidentDescription}`);
  doc.moveDown(1);

  doc.fontSize(12).text("Korban / Penerima Santunan");
  doc.fontSize(10);
  doc.text(`Nama: ${claim.claimant.fullName ?? "-"}`);
  doc.text(`NIK: ${claim.claimant.nik ?? "-"}`);
  doc.text(`Hubungan: ${claim.claimant.relationshipToVictim ?? "-"}`);
  if (claim.claimant.bankName) {
    doc.text(`Rekening: ${claim.claimant.bankName} - ${claim.claimant.bankAccountNumber ?? "-"} a.n. ${claim.claimant.bankAccountHolder ?? "-"}`);
  }
  doc.moveDown(1);

  doc.fontSize(12).text("Kalkulasi Santunan (Rules Engine)");
  doc.fontSize(10);
  doc.text(`Estimasi: ${formatCurrency(claim.estimatedAmount)}`);
  doc.text(`Disetujui: ${formatCurrency(claim.approvedAmount)}`);
  doc.moveDown(1);

  doc.fontSize(12).text("Riwayat Status");
  doc.fontSize(10);
  for (const entry of claim.timeline) {
    const line = `${new Date(entry.at).toLocaleString("id-ID")} - ${entry.label}${entry.detail ? `: ${entry.detail}` : ""}`;
    doc.text(line);
  }

  doc.end();
  return done;
}
