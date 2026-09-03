import type { NextRequest } from "next/server";

export interface AccidentPointFilters {
  branch?: string;
  province?: string;
  dateFrom?: Date;
  dateTo?: Date;
  near?: { lat: number; lng: number; radiusMeters: number };
}

export function parseAccidentPointFilters(request: NextRequest): AccidentPointFilters {
  const { searchParams } = new URL(request.url);

  const filters: AccidentPointFilters = {};

  const branch = searchParams.get("branch");
  if (branch) filters.branch = branch;

  const province = searchParams.get("province");
  if (province) filters.province = province;

  const dateFromParam = searchParams.get("dateFrom");
  if (dateFromParam) {
    const d = new Date(dateFromParam);
    if (!isNaN(d.getTime())) filters.dateFrom = d;
  }

  const dateToParam = searchParams.get("dateTo");
  if (dateToParam) {
    const d = new Date(dateToParam);
    if (!isNaN(d.getTime())) filters.dateTo = d;
  }

  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radiusMeters = Number(searchParams.get("radiusMeters") ?? 5000);
  if (!isNaN(lat) && !isNaN(lng) && searchParams.has("lat") && searchParams.has("lng")) {
    filters.near = { lat, lng, radiusMeters: isNaN(radiusMeters) ? 5000 : radiusMeters };
  }

  return filters;
}

export function buildAccidentPointMatch(filters: AccidentPointFilters): Record<string, unknown> {
  const match: Record<string, unknown> = {};

  if (filters.branch) match.branch = filters.branch;
  if (filters.province) match.province = filters.province;

  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, Date> = {};
    if (filters.dateFrom) range.$gte = filters.dateFrom;
    if (filters.dateTo) range.$lte = filters.dateTo;
    match.accidentDate = range;
  }

  return match;
}
