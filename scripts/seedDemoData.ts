import { config } from "dotenv";
config({ path: ".env.local" });

import { connectToDatabase } from "../lib/mongodb";
import { generateClaimNumber } from "../lib/claimNumber";
import { generateMockAccidentPoints } from "../lib/accidentPointSeeds";
import Claim from "../models/Claim";
import Claimant from "../models/Claimant";
import Payment from "../models/Payment";
import AccidentPoint from "../models/AccidentPoint";
import User from "../models/User";

// Populates realistic-looking demo data (claims across every status,
// matching claimants/payments, and clustered accident points) so the
// dashboard/claims/map/fraud-detection pages have something real to show
// instead of empty states. Every document is tagged isDemo:true (source:
// "mock" for accident points, which already had that enum value for this
// exact purpose) so it can be wiped from Pengaturan Situs without touching
// any real production data.

const CITIES = [
  { city: "Jakarta Pusat", province: "DKI Jakarta", branch: "Cabang Jakarta", lat: -6.1805, lng: 106.8284 },
  { city: "Bandung", province: "Jawa Barat", branch: "Cabang Bandung", lat: -6.9175, lng: 107.6191 },
  { city: "Surabaya", province: "Jawa Timur", branch: "Cabang Surabaya", lat: -7.2575, lng: 112.7521 },
  { city: "Medan", province: "Sumatera Utara", branch: "Cabang Medan", lat: 3.5952, lng: 98.6722 },
  { city: "Makassar", province: "Sulawesi Selatan", branch: "Cabang Makassar", lat: -5.1477, lng: 119.4327 },
];

const CLAIMANT_NAMES = [
  "Ahmad Fauzi", "Siti Nurhaliza", "Budi Santoso", "Dewi Lestari", "Rudi Hartono",
  "Rina Wijaya", "Agus Setiawan", "Maya Sari", "Hendra Gunawan", "Putri Ramadhani",
];

const RELATIONSHIPS = ["Diri sendiri", "Ahli waris (istri)", "Ahli waris (suami)", "Ahli waris (anak)", "Ahli waris (orang tua)"];

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

async function main() {
  await connectToDatabase();

  const admin = await User.findOne({}).sort({ createdAt: 1 });
  if (!admin) {
    console.log("Tidak ada user - jalankan `npm run seed` terlebih dahulu untuk membuat Super Admin.");
    process.exit(1);
  }

  console.log("Menghapus data contoh sebelumnya (isDemo: true)...");
  const oldClaims = await Claim.find({ isDemo: true }).select("_id");
  const oldClaimIds = oldClaims.map((c) => c._id);
  await Payment.deleteMany({ claimId: { $in: oldClaimIds } });
  await Claim.deleteMany({ isDemo: true });
  await Claimant.deleteMany({ isDemo: true });
  await AccidentPoint.deleteMany({ source: "mock" });

  console.log("Membuat data klaim contoh...");
  const CASE_CATEGORIES = ["meninggal_dunia", "cacat_tetap", "perawatan", "penguburan"] as const;
  const TRANSPORT_MODES = ["darat_laut", "udara"] as const;
  const ESTIMATE_BY_CATEGORY: Record<(typeof CASE_CATEGORIES)[number], () => number> = {
    meninggal_dunia: () => 50_000_000,
    cacat_tetap: () => randomInt(10, 50) * 1_000_000,
    perawatan: () => randomInt(2, 20) * 1_000_000,
    penguburan: () => 4_000_000,
  };

  type ClaimStatus = "draft" | "submitted" | "verified" | "approved" | "paid" | "rejected";

  // status distribution: a realistic pipeline, not evenly split
  const STATUS_PLAN: { status: ClaimStatus; count: number }[] = [
    { status: "draft", count: 2 },
    { status: "submitted", count: 3 },
    { status: "verified", count: 2 },
    { status: "approved", count: 2 },
    { status: "paid", count: 8 },
    { status: "rejected", count: 2 },
  ];

  let claimsCreated = 0;
  let paymentsCreated = 0;

  for (const plan of STATUS_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      const location = randomItem(CITIES);
      const category = randomItem(CASE_CATEGORIES);
      const transportMode = randomItem(TRANSPORT_MODES);
      const ageInDays = randomInt(1, 180);

      const claimant = await Claimant.create({
        fullName: `${randomItem(CLAIMANT_NAMES)} ${randomInt(1, 99)}`,
        nik: `32${randomInt(1000000000, 9999999999)}`,
        relationshipToVictim: randomItem(RELATIONSHIPS),
        phone: `08${randomInt(1000000000, 9999999999).toString().slice(0, 10)}`,
        address: `Jl. Contoh No. ${randomInt(1, 200)}, ${location.city}`,
        bankName: randomItem(["BRI", "BNI", "Mandiri", "BCA"]),
        bankAccountNumber: `${randomInt(1000000000, 9999999999)}`,
        bankAccountHolder: randomItem(CLAIMANT_NAMES),
        isDemo: true,
      });

      const estimatedAmount = ESTIMATE_BY_CATEGORY[category]();
      const isResolved = ["approved", "paid"].includes(plan.status);
      const claimNumber = await generateClaimNumber();

      const claim = await Claim.create({
        claimNumber,
        reporterId: admin._id,
        branch: location.branch,
        claimantId: claimant._id,
        accidentDate: daysAgo(ageInDays + 2),
        accidentLocation: `Jl. Raya ${location.city} KM ${randomInt(1, 20)}`,
        accidentDescription: "Kecelakaan lalu lintas melibatkan kendaraan bermotor - data contoh untuk demonstrasi sistem.",
        transportMode,
        caseCategory: category,
        disabilityPercentage: category === "cacat_tetap" ? randomInt(10, 100) : null,
        claimedTreatmentCost: category === "perawatan" ? estimatedAmount : null,
        status: plan.status,
        submittedAt: plan.status === "draft" ? null : daysAgo(ageInDays),
        estimatedAmount: plan.status === "draft" ? null : estimatedAmount,
        approvedAmount: isResolved ? estimatedAmount : null,
        verification:
          ["verified", "approved", "paid", "rejected"].includes(plan.status) && plan.status !== "rejected"
            ? { verifiedBy: admin._id, verifiedAt: daysAgo(ageInDays - 1), notes: "Kelengkapan dokumen sesuai (data contoh)" }
            : null,
        approval: isResolved ? { approvedBy: admin._id, approvedAt: daysAgo(ageInDays - 2), notes: "Disetujui sesuai tarif (data contoh)" } : null,
        rejection:
          plan.status === "rejected"
            ? { rejectedBy: admin._id, rejectedAt: daysAgo(ageInDays - 1), reason: "Dokumen pendukung tidak lengkap (data contoh)" }
            : null,
        isDemo: true,
      });
      claimsCreated += 1;

      if (plan.status === "paid") {
        await Payment.create({
          claimId: claim._id,
          amount: estimatedAmount,
          method: "transfer_bank",
          bankName: claimant.bankName,
          bankAccountNumber: claimant.bankAccountNumber,
          bankAccountHolder: claimant.bankAccountHolder,
          reference: `TRF-DEMO-${randomInt(100000, 999999)}`,
          recordedBy: admin._id,
          recordedAt: daysAgo(ageInDays - 3),
          isDemo: true,
        });
        paymentsCreated += 1;
      }
    }
  }

  console.log(`  - ${claimsCreated} klaim, ${paymentsCreated} pencairan santunan`);

  console.log("Membuat titik kecelakaan contoh (termasuk klaster untuk deteksi titik rawan)...");
  await AccidentPoint.syncIndexes();
  const accidentRecords = generateMockAccidentPoints();
  await AccidentPoint.insertMany(
    accidentRecords.map((r) => ({
      location: { type: "Point" as const, coordinates: [r.lng, r.lat] as [number, number] },
      branch: r.branch,
      province: r.province,
      city: r.city,
      accidentDate: r.accidentDate,
      severity: r.severity,
      vehicleType: r.vehicleType,
      casualtyCount: r.casualtyCount,
      description: r.description,
      source: "mock" as const,
    }))
  );

  console.log(`  - ${accidentRecords.length} titik kecelakaan`);
  console.log("\nSelesai. Hapus lewat Pengaturan Situs > \"Hapus Data Contoh\" kapan saja.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
