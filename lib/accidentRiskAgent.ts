import { groqChatCompletion, GroqError } from "@/lib/groqClient";
import { getWeatherReading, type WeatherReading } from "@/lib/weatherService";
import AccidentPoint, { type AccidentVehicleType } from "@/models/AccidentPoint";

export type RiskLevel = "rendah" | "sedang" | "tinggi";

export type RiskFactor = {
  label: string;
  detail: string;
};

export type AccidentRiskResult = {
  branch: string;
  dateTime: string;
  vehicleType: AccidentVehicleType;
  riskScore: number; // 0-100, deterministic composite score
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  narrative: string | null; // LLM-written summary of the factors below
  weather: WeatherReading | null;
  sampleSize: number; // how many historical points this score is based on
  lowConfidence: boolean; // true when sampleSize is too small to trust
  generatedAt: string;
  isSuggestionOnly: true;
};

const MIN_RELIABLE_SAMPLE = 5;

const SEVERITY_WEIGHT: Record<string, number> = { ringan: 1, sedang: 2, berat: 3, meninggal_dunia: 4 };

const VEHICLE_LABELS: Record<AccidentVehicleType, string> = {
  motor: "Sepeda motor",
  mobil: "Mobil",
  truk_bus: "Truk/Bus",
  lainnya: "Lainnya",
};

function bucketRiskLevel(score: number): RiskLevel {
  if (score >= 65) return "tinggi";
  if (score >= 35) return "sedang";
  return "rendah";
}

async function computeBranchCentroid(branch: string): Promise<{ lat: number; lng: number } | null> {
  const result = await AccidentPoint.aggregate<{ _id: null; lat: number; lng: number }>([
    { $match: { branch } },
    {
      $group: {
        _id: null,
        lat: { $avg: { $arrayElemAt: ["$location.coordinates", 1] } },
        lng: { $avg: { $arrayElemAt: ["$location.coordinates", 0] } },
      },
    },
  ]);
  return result[0] ? { lat: result[0].lat, lng: result[0].lng } : null;
}

async function narrateRiskFactors(params: {
  branch: string;
  riskScore: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
}): Promise<string | null> {
  if (params.factors.length === 0) return null;

  try {
    const prompt = [
      "Anda adalah analis keselamatan lalu lintas untuk Jasa Raharja. Berdasarkan faktor-faktor di bawah, tulis SATU kalimat ringkas (Bahasa Indonesia) yang merangkum faktor utama penyebab tingkat risiko ini - jangan menambah asumsi atau angka baru di luar yang diberikan.",
      "Ini adalah SARAN berbasis data historis, bukan prediksi pasti.",
      "",
      `Wilayah: ${params.branch}. Skor risiko: ${params.riskScore}/100 (${params.riskLevel}).`,
      "Faktor terdeteksi:",
      ...params.factors.map((f, i) => `${i + 1}. ${f.label}: ${f.detail}`),
      "",
      'Jawab HANYA dalam format JSON: {"narrative": "<kalimat ringkas>"}',
    ].join("\n");

    const raw = await groqChatCompletion([{ role: "user", content: prompt }], { jsonMode: true, temperature: 0.2 });
    const parsed = JSON.parse(raw) as { narrative?: string };
    return typeof parsed.narrative === "string" ? parsed.narrative : null;
  } catch (error) {
    // Non-fatal - the deterministic score/factors are still returned even
    // if the LLM narrative step fails (e.g. GROQ_API_KEY unavailable).
    if (!(error instanceof GroqError)) throw error;
    return null;
  }
}

/**
 * Deterministic accident-risk estimate for a branch/time/vehicle-type
 * combination, built entirely from real AccidentPoint history - no trained
 * model, no invented numbers. Mirrors lib/fraudDetectionAgent.ts's shape:
 * plain statistics compute the score, an LLM only narrates the already-
 * computed factors afterward. Weather is a real (Open-Meteo) but minor
 * signal, never the dominant one.
 */
export async function computeAccidentRisk(input: {
  branch: string;
  dateTime: Date;
  vehicleType: AccidentVehicleType;
}): Promise<AccidentRiskResult> {
  const { branch, dateTime, vehicleType } = input;

  const branchPoints = await AccidentPoint.find({ branch })
    .select("location accidentDate severity vehicleType")
    .lean();

  const branchCounts = await AccidentPoint.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$branch", count: { $sum: 1 } } },
  ]);
  const globalAvgPerBranch =
    branchCounts.length > 0 ? branchCounts.reduce((sum, b) => sum + b.count, 0) / branchCounts.length : 0;

  const sampleSize = branchPoints.length;
  const factors: RiskFactor[] = [];
  let score = 0;

  // Signal 1: accident density in this branch vs. the network-wide average.
  const densityRatio = globalAvgPerBranch > 0 ? sampleSize / globalAvgPerBranch : 0;
  score += Math.min(35, Math.round(densityRatio * 17.5));
  if (densityRatio > 1.1) {
    factors.push({
      label: "Kepadatan kecelakaan",
      detail: `${sampleSize} kejadian tercatat di wilayah ini, ${densityRatio.toFixed(1)}x rata-rata jaringan (${globalAvgPerBranch.toFixed(0)} per wilayah)`,
    });
  }

  // Signal 2: how many of this branch's accidents happened within +/-2h of
  // the requested hour - a real time-of-day pattern from actual timestamps.
  const requestedHour = dateTime.getHours();
  const nearHourCount = branchPoints.filter((p) => {
    const h = new Date(p.accidentDate).getHours();
    const diff = Math.min(Math.abs(h - requestedHour), 24 - Math.abs(h - requestedHour));
    return diff <= 2;
  }).length;
  const timeMatchRatio = sampleSize > 0 ? nearHourCount / sampleSize : 0;
  score += Math.round(timeMatchRatio * 25);
  if (nearHourCount > 0) {
    factors.push({
      label: "Pola waktu kejadian",
      detail: `${nearHourCount} dari ${sampleSize} kejadian di wilayah ini terjadi dalam rentang ±2 jam dari pukul ${String(requestedHour).padStart(2, "0")}:00`,
    });
  }

  // Signal 3: proportion matching the requested vehicle type.
  const vehicleMatchCount = branchPoints.filter((p) => p.vehicleType === vehicleType).length;
  const vehicleMatchRatio = sampleSize > 0 ? vehicleMatchCount / sampleSize : 0;
  score += Math.round(vehicleMatchRatio * 15);
  if (vehicleMatchCount > 0) {
    factors.push({
      label: "Jenis kendaraan",
      detail: `${vehicleMatchCount} dari ${sampleSize} kejadian di wilayah ini melibatkan ${VEHICLE_LABELS[vehicleType].toLowerCase()}`,
    });
  }

  // Signal 4: how severe accidents in this branch tend to be.
  const severitySum = branchPoints.reduce((sum, p) => sum + (SEVERITY_WEIGHT[p.severity] ?? 1), 0);
  const avgSeverity = sampleSize > 0 ? severitySum / sampleSize : 0;
  score += Math.round((avgSeverity / 4) * 15);
  if (avgSeverity >= 2) {
    factors.push({
      label: "Tingkat keparahan historis",
      detail: `Rata-rata tingkat keparahan kecelakaan di wilayah ini ${avgSeverity.toFixed(1)}/4`,
    });
  }

  // Signal 5 (real but minor): weather at the branch centroid, from
  // AccidentPoint's own geocoded data - not a fabricated coordinate.
  let weather: WeatherReading | null = null;
  const centroid = await computeBranchCentroid(branch);
  if (centroid) {
    weather = await getWeatherReading(centroid.lat, centroid.lng, dateTime);
    if (weather?.isHazardous) {
      score += 10;
      factors.push({
        label: "Cuaca",
        detail: `Kondisi cuaca "${weather.condition}" pada waktu tersebut (${weather.source === "forecast" ? "prakiraan" : "data historis"})`,
      });
    }
  }

  const riskScore = Math.max(0, Math.min(100, Math.round(score)));
  const riskLevel = bucketRiskLevel(riskScore);
  const lowConfidence = sampleSize < MIN_RELIABLE_SAMPLE;

  const narrative = await narrateRiskFactors({ branch, riskScore, riskLevel, factors });

  return {
    branch,
    dateTime: dateTime.toISOString(),
    vehicleType,
    riskScore,
    riskLevel,
    factors,
    narrative,
    weather,
    sampleSize,
    lowConfidence,
    generatedAt: new Date().toISOString(),
    isSuggestionOnly: true,
  };
}
