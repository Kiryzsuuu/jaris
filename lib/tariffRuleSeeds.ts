import type { CaseCategory, TransportMode } from "@/lib/claimTypes";

// Reference tariff data for the deterministic rules engine (lib/tariffEngine.ts).
// Indicative nominal values - replace with the official current Jasa Raharja
// tariff table before production use (see PRD §8, belum final).
export const TARIFF_RULE_SEEDS: {
  category: CaseCategory;
  transportMode: TransportMode;
  maxAmount: number;
  description: string;
  effectiveDate: string;
}[] = [
  {
    category: "meninggal_dunia",
    transportMode: "darat_laut",
    maxAmount: 50_000_000,
    description: "Santunan meninggal dunia - angkutan darat/laut",
    effectiveDate: "2017-01-01",
  },
  {
    category: "meninggal_dunia",
    transportMode: "udara",
    maxAmount: 50_000_000,
    description: "Santunan meninggal dunia - angkutan udara",
    effectiveDate: "2017-01-01",
  },
  {
    category: "cacat_tetap",
    transportMode: "darat_laut",
    maxAmount: 50_000_000,
    description: "Santunan cacat tetap maksimum - angkutan darat/laut (dihitung proporsional sesuai persentase cacat)",
    effectiveDate: "2017-01-01",
  },
  {
    category: "cacat_tetap",
    transportMode: "udara",
    maxAmount: 50_000_000,
    description: "Santunan cacat tetap maksimum - angkutan udara (dihitung proporsional sesuai persentase cacat)",
    effectiveDate: "2017-01-01",
  },
  {
    category: "perawatan",
    transportMode: "darat_laut",
    maxAmount: 20_000_000,
    description: "Penggantian biaya perawatan maksimum - angkutan darat/laut",
    effectiveDate: "2017-01-01",
  },
  {
    category: "perawatan",
    transportMode: "udara",
    maxAmount: 25_000_000,
    description: "Penggantian biaya perawatan maksimum - angkutan udara",
    effectiveDate: "2017-01-01",
  },
  {
    category: "penguburan",
    transportMode: "darat_laut",
    maxAmount: 4_000_000,
    description: "Biaya penguburan (korban tanpa ahli waris) - angkutan darat/laut",
    effectiveDate: "2017-01-01",
  },
  {
    category: "penguburan",
    transportMode: "udara",
    maxAmount: 4_000_000,
    description: "Biaya penguburan (korban tanpa ahli waris) - angkutan udara",
    effectiveDate: "2017-01-01",
  },
];
