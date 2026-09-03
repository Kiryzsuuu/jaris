import Claim from "@/models/Claim";

export async function generateClaimNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SR-${year}-`;

  const count = await Claim.countDocuments({ claimNumber: { $regex: `^${prefix}` } });
  let sequence = count + 1;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}${String(sequence).padStart(6, "0")}`;
    const exists = await Claim.exists({ claimNumber: candidate });
    if (!exists) return candidate;
    sequence += 1;
  }

  throw new Error("Gagal membuat nomor klaim unik, coba lagi");
}
