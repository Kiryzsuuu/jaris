import type { CaseCategory, TransportMode } from "@/lib/claimTypes";

/**
 * Deterministic compensation calculation (rules engine).
 * No LLM/AI involved - output must be fully reproducible and auditable.
 * See PRD §3.2: "Kalkulasi tarif santunan bersifat deterministik, bukan generatif."
 */

export interface TariffRuleInput {
  category: CaseCategory;
  transportMode: TransportMode;
  maxAmount: number;
}

export interface CompensationInput {
  category: CaseCategory;
  transportMode: TransportMode;
  disabilityPercentage?: number | null;
  claimedTreatmentCost?: number | null;
}

export interface CompensationResult {
  amount: number;
  maxAmount: number;
  formula: string;
}

export class TariffEngineError extends Error {}

export function calculateCompensation(
  tariffRule: TariffRuleInput,
  input: CompensationInput
): CompensationResult {
  if (tariffRule.category !== input.category) {
    throw new TariffEngineError("Tarif tidak sesuai kategori kasus klaim");
  }
  if (tariffRule.transportMode !== input.transportMode) {
    throw new TariffEngineError("Tarif tidak sesuai moda transportasi klaim");
  }

  switch (input.category) {
    case "meninggal_dunia":
    case "penguburan": {
      return {
        amount: tariffRule.maxAmount,
        maxAmount: tariffRule.maxAmount,
        formula: `Santunan tetap sesuai tarif: Rp${tariffRule.maxAmount.toLocaleString("id-ID")}`,
      };
    }

    case "cacat_tetap": {
      const percentage = input.disabilityPercentage;
      if (percentage === null || percentage === undefined) {
        throw new TariffEngineError(
          "disabilityPercentage wajib diisi untuk kategori cacat_tetap"
        );
      }
      if (percentage < 0 || percentage > 100) {
        throw new TariffEngineError("disabilityPercentage harus di antara 0-100");
      }
      const amount = Math.round((tariffRule.maxAmount * percentage) / 100);
      return {
        amount,
        maxAmount: tariffRule.maxAmount,
        formula: `${percentage}% x Rp${tariffRule.maxAmount.toLocaleString("id-ID")} = Rp${amount.toLocaleString("id-ID")}`,
      };
    }

    case "perawatan": {
      const cost = input.claimedTreatmentCost;
      if (cost === null || cost === undefined) {
        throw new TariffEngineError(
          "claimedTreatmentCost wajib diisi untuk kategori perawatan"
        );
      }
      if (cost < 0) {
        throw new TariffEngineError("claimedTreatmentCost tidak boleh negatif");
      }
      const amount = Math.min(cost, tariffRule.maxAmount);
      return {
        amount,
        maxAmount: tariffRule.maxAmount,
        formula: `min(biaya klaim Rp${cost.toLocaleString("id-ID")}, maksimum Rp${tariffRule.maxAmount.toLocaleString("id-ID")}) = Rp${amount.toLocaleString("id-ID")}`,
      };
    }

    default: {
      const _exhaustive: never = input.category;
      throw new TariffEngineError(`Kategori tidak dikenal: ${_exhaustive}`);
    }
  }
}
