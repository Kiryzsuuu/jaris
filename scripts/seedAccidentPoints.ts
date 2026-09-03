// Seeds dummy (mock) accident points scattered across several Indonesian
// regions, including deliberate tight clusters so cluster/blackspot
// detection (lib/accidentClustering.ts) has real data to find.
// This is placeholder data pending the official Korlantas Polri integration
// (PRD §9) - every seeded document is tagged source: "mock".
import { config } from "dotenv";
config({ path: ".env.local" });

import { connectToDatabase } from "../lib/mongodb";
import { generateMockAccidentPoints } from "../lib/accidentPointSeeds";
import AccidentPoint from "../models/AccidentPoint";

async function main() {
  await connectToDatabase();

  const existing = await AccidentPoint.countDocuments({ source: "mock" });
  if (existing > 0 && !process.argv.includes("--force")) {
    console.log(
      `Sudah ada ${existing} titik kecelakaan mock. Jalankan dengan --force untuk menambah data baru.`
    );
    process.exit(0);
  }

  console.log("Membuat index geospasial (2dsphere)...");
  await AccidentPoint.syncIndexes();

  console.log("Generating mock accident points...");
  const records = generateMockAccidentPoints();

  const docs = records.map((r) => ({
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
  }));

  await AccidentPoint.insertMany(docs);

  const byCity = new Map<string, number>();
  for (const r of records) byCity.set(r.city, (byCity.get(r.city) ?? 0) + 1);

  console.log(`\nBerhasil menyisipkan ${docs.length} titik kecelakaan mock:`);
  for (const [city, count] of byCity) {
    console.log(`  - ${city}: ${count} titik`);
  }

  console.log("\nSelesai.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
