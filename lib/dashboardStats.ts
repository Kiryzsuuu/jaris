import { Types } from "mongoose";
import Claim from "@/models/Claim";
import Payment from "@/models/Payment";
import { CLAIM_STATUSES, CASE_CATEGORIES } from "@/lib/claimTypes";

// Internal service target for claim resolution (submitted -> paid), used to
// compute an SLA compliance rate. Not admin-configurable yet - a fixed,
// documented constant is more honest than inventing a per-branch target
// the org hasn't actually set.
export const SLA_TARGET_DAYS = 14;

export interface DashboardFilters {
  branch?: string;
  dateFrom?: Date;
  dateTo?: Date;
  reporterId?: string;
}

function buildClaimMatch(filters: DashboardFilters): Record<string, unknown> {
  const match: Record<string, unknown> = {};

  if (filters.branch) match.branch = filters.branch;
  if (filters.reporterId) match.reporterId = new Types.ObjectId(filters.reporterId);

  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, Date> = {};
    if (filters.dateFrom) range.$gte = filters.dateFrom;
    if (filters.dateTo) range.$lte = filters.dateTo;
    match.accidentDate = range;
  }

  return match;
}

function prefixMatch(match: Record<string, unknown>, prefix: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(match).map(([key, value]) => [`${prefix}${key}`, value]));
}

export interface ClaimsByStatus {
  status: string;
  count: number;
}

/** Jumlah klaim per status. */
export async function getClaimsByStatus(filters: DashboardFilters): Promise<ClaimsByStatus[]> {
  const match = buildClaimMatch(filters);

  const results = await Claim.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const countByStatus = new Map(results.map((r) => [r._id as string, r.count as number]));
  return CLAIM_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
}

export interface PaymentsByBranch {
  branch: string;
  totalPaid: number;
  paymentCount: number;
}

/** Realisasi santunan (total dan jumlah pencairan) per wilayah/cabang. */
export async function getPaymentsByBranch(filters: DashboardFilters): Promise<PaymentsByBranch[]> {
  const claimMatch = buildClaimMatch(filters);

  const results = await Payment.aggregate([
    {
      $lookup: {
        from: "claims",
        localField: "claimId",
        foreignField: "_id",
        as: "claim",
      },
    },
    { $unwind: "$claim" },
    { $match: prefixMatch(claimMatch, "claim.") },
    {
      $group: {
        _id: "$claim.branch",
        totalPaid: { $sum: "$amount" },
        paymentCount: { $sum: 1 },
      },
    },
    { $sort: { totalPaid: -1 } },
  ]);

  return results.map((r) => ({
    branch: r._id as string,
    totalPaid: r.totalPaid as number,
    paymentCount: r.paymentCount as number,
  }));
}

export interface MonthlyAccidentTrend {
  year: number;
  month: number;
  count: number;
}

/** Tren jumlah kecelakaan per bulan, berdasarkan tanggal kejadian (accidentDate). */
export async function getMonthlyAccidentTrend(
  filters: DashboardFilters
): Promise<MonthlyAccidentTrend[]> {
  const match = buildClaimMatch(filters);

  const results = await Claim.aggregate([
    { $match: match },
    {
      $group: {
        _id: { year: { $year: "$accidentDate" }, month: { $month: "$accidentDate" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  return results.map((r) => ({
    year: r._id.year as number,
    month: r._id.month as number,
    count: r.count as number,
  }));
}

export interface ResolutionStats {
  avgResolutionDays: number | null;
  sampleSize: number;
  slaTargetDays: number;
  withinSlaCount: number;
  withinSlaPercent: number | null;
}

/**
 * Tingkat penyelesaian kasus - rata-rata waktu (hari) dari status submitted
 * (Claim.submittedAt) hingga pencairan dicatat (Payment.recordedAt), untuk
 * klaim yang sudah lunas (paid), plus berapa persen yang selesai dalam
 * target SLA (SLA_TARGET_DAYS). null jika belum ada sampel yang lengkap.
 */
export async function getAvgResolutionDays(filters: DashboardFilters): Promise<ResolutionStats> {
  const claimMatch = buildClaimMatch(filters);
  const slaTargetMs = SLA_TARGET_DAYS * 24 * 60 * 60 * 1000;

  const results = await Payment.aggregate([
    {
      $lookup: {
        from: "claims",
        localField: "claimId",
        foreignField: "_id",
        as: "claim",
      },
    },
    { $unwind: "$claim" },
    {
      $match: {
        ...prefixMatch(claimMatch, "claim."),
        "claim.submittedAt": { $ne: null },
      },
    },
    {
      $project: {
        durationMs: { $subtract: ["$recordedAt", "$claim.submittedAt"] },
      },
    },
    {
      $group: {
        _id: null,
        avgDurationMs: { $avg: "$durationMs" },
        sampleSize: { $sum: 1 },
        withinSlaCount: { $sum: { $cond: [{ $lte: ["$durationMs", slaTargetMs] }, 1, 0] } },
      },
    },
  ]);

  if (results.length === 0) {
    return { avgResolutionDays: null, sampleSize: 0, slaTargetDays: SLA_TARGET_DAYS, withinSlaCount: 0, withinSlaPercent: null };
  }

  const { avgDurationMs, sampleSize, withinSlaCount } = results[0];
  return {
    avgResolutionDays: Math.round((avgDurationMs / (1000 * 60 * 60 * 24)) * 10) / 10,
    sampleSize,
    slaTargetDays: SLA_TARGET_DAYS,
    withinSlaCount,
    withinSlaPercent: sampleSize > 0 ? Math.round((withinSlaCount / sampleSize) * 1000) / 10 : null,
  };
}

export interface MonthlyClaimsAndPayments {
  year: number;
  month: number;
  claimsCount: number;
  paidAmount: number;
}

/** Tren bulanan gabungan: jumlah klaim diajukan (submittedAt) vs. total
 * santunan dicairkan (Payment.recordedAt) - dipakai untuk grafik
 * perbandingan "Tren Klaim & Pencairan". Independen dari
 * getMonthlyAccidentTrend, yang berbasis tanggal kejadian, bukan pengajuan. */
export async function getMonthlyClaimsAndPayments(
  filters: DashboardFilters,
  monthsBack = 6
): Promise<MonthlyClaimsAndPayments[]> {
  const claimMatch = buildClaimMatch(filters);
  delete claimMatch.accidentDate; // this trend is keyed by submission/payment date, not accident date

  const since = new Date();
  since.setMonth(since.getMonth() - (monthsBack - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [claimRows, paymentRows] = await Promise.all([
    Claim.aggregate([
      { $match: { ...claimMatch, submittedAt: { $ne: null, $gte: since } } },
      { $group: { _id: { year: { $year: "$submittedAt" }, month: { $month: "$submittedAt" } }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      {
        $lookup: { from: "claims", localField: "claimId", foreignField: "_id", as: "claim" },
      },
      { $unwind: "$claim" },
      { $match: { ...prefixMatch(claimMatch, "claim."), recordedAt: { $gte: since } } },
      { $group: { _id: { year: { $year: "$recordedAt" }, month: { $month: "$recordedAt" } }, total: { $sum: "$amount" } } },
    ]),
  ]);

  const claimsByKey = new Map(claimRows.map((r) => [`${r._id.year}-${r._id.month}`, r.count as number]));
  const paidByKey = new Map(paymentRows.map((r) => [`${r._id.year}-${r._id.month}`, r.total as number]));

  const result: MonthlyClaimsAndPayments[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < monthsBack; i++) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const key = `${year}-${month}`;
    result.push({
      year,
      month,
      claimsCount: claimsByKey.get(key) ?? 0,
      paidAmount: paidByKey.get(key) ?? 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

export interface ClaimsByCategory {
  caseCategory: string;
  count: number;
}

/** Jumlah klaim per kategori kasus (meninggal dunia, cacat tetap, perawatan, penguburan). */
export async function getClaimsByCategory(filters: DashboardFilters): Promise<ClaimsByCategory[]> {
  const match = buildClaimMatch(filters);

  const results = await Claim.aggregate([
    { $match: match },
    { $group: { _id: "$caseCategory", count: { $sum: 1 } } },
  ]);

  const countByCategory = new Map(results.map((r) => [r._id as string, r.count as number]));
  return CASE_CATEGORIES.map((caseCategory) => ({ caseCategory, count: countByCategory.get(caseCategory) ?? 0 }));
}

/**
 * Simple linear-regression projection of the next `monthsAhead` months from
 * historical monthly counts - plain math, no AI, clearly a projection (not
 * a claim about the future) rather than a forecasted "prediction". Needs at
 * least 2 historical points; returns [] otherwise since a single point
 * can't support a trend line.
 */
export function projectMonthlyTrend(
  history: MonthlyAccidentTrend[],
  monthsAhead = 3
): MonthlyAccidentTrend[] {
  if (history.length < 2) return [];

  const n = history.length;
  const xs = history.map((_, i) => i);
  const ys = history.map((h) => h.count);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  const last = history[history.length - 1];
  const projections: MonthlyAccidentTrend[] = [];
  for (let step = 1; step <= monthsAhead; step++) {
    const projectedCount = Math.max(0, Math.round(intercept + slope * (n - 1 + step)));
    let month = last.month + step;
    let year = last.year;
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    projections.push({ year, month, count: projectedCount });
  }
  return projections;
}

export interface DashboardSummary {
  claimsByStatus: ClaimsByStatus[];
  paymentsByBranch: PaymentsByBranch[];
  monthlyAccidentTrend: MonthlyAccidentTrend[];
  monthlyClaimsAndPayments: MonthlyClaimsAndPayments[];
  trendProjection: MonthlyAccidentTrend[];
  claimsByCategory: ClaimsByCategory[];
  resolution: ResolutionStats;
  totalClaims: number;
  totalPaidAmount: number;
}

export async function getDashboardSummary(filters: DashboardFilters): Promise<DashboardSummary> {
  const [claimsByStatus, paymentsByBranch, monthlyAccidentTrend, monthlyClaimsAndPayments, resolution, claimsByCategory] =
    await Promise.all([
      getClaimsByStatus(filters),
      getPaymentsByBranch(filters),
      getMonthlyAccidentTrend(filters),
      getMonthlyClaimsAndPayments(filters),
      getAvgResolutionDays(filters),
      getClaimsByCategory(filters),
    ]);
  const trendProjection = projectMonthlyTrend(monthlyAccidentTrend);

  return {
    claimsByStatus,
    trendProjection,
    claimsByCategory,
    paymentsByBranch,
    monthlyAccidentTrend,
    monthlyClaimsAndPayments,
    resolution,
    totalClaims: claimsByStatus.reduce((sum, s) => sum + s.count, 0),
    totalPaidAmount: paymentsByBranch.reduce((sum, b) => sum + b.totalPaid, 0),
  };
}
