import { Types } from "mongoose";
import Claim from "@/models/Claim";
import Payment from "@/models/Payment";
import { CLAIM_STATUSES } from "@/lib/claimTypes";

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
}

/**
 * Tingkat penyelesaian kasus - rata-rata waktu (hari) dari status submitted
 * (Claim.submittedAt) hingga pencairan dicatat (Payment.recordedAt), untuk
 * klaim yang sudah lunas (paid). null jika belum ada sampel yang lengkap.
 */
export async function getAvgResolutionDays(filters: DashboardFilters): Promise<ResolutionStats> {
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
      },
    },
  ]);

  if (results.length === 0) {
    return { avgResolutionDays: null, sampleSize: 0 };
  }

  const { avgDurationMs, sampleSize } = results[0];
  return {
    avgResolutionDays: Math.round((avgDurationMs / (1000 * 60 * 60 * 24)) * 10) / 10,
    sampleSize,
  };
}

export interface DashboardSummary {
  claimsByStatus: ClaimsByStatus[];
  paymentsByBranch: PaymentsByBranch[];
  monthlyAccidentTrend: MonthlyAccidentTrend[];
  resolution: ResolutionStats;
  totalClaims: number;
  totalPaidAmount: number;
}

export async function getDashboardSummary(filters: DashboardFilters): Promise<DashboardSummary> {
  const [claimsByStatus, paymentsByBranch, monthlyAccidentTrend, resolution] = await Promise.all([
    getClaimsByStatus(filters),
    getPaymentsByBranch(filters),
    getMonthlyAccidentTrend(filters),
    getAvgResolutionDays(filters),
  ]);

  return {
    claimsByStatus,
    paymentsByBranch,
    monthlyAccidentTrend,
    resolution,
    totalClaims: claimsByStatus.reduce((sum, s) => sum + s.count, 0),
    totalPaidAmount: paymentsByBranch.reduce((sum, b) => sum + b.totalPaid, 0),
  };
}
