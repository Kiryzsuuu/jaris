import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { parseAccidentPointFilters, buildAccidentPointMatch } from "@/lib/accidentPointFilters";
import { detectClusters } from "@/lib/accidentClustering";
import AccidentPoint from "@/models/AccidentPoint";

const MAX_POINTS_FOR_CLUSTERING = 5000;

/**
 * Pattern-detection signal: repeated-accident blackspots ("titik rawan").
 * Points within `radiusMeters` of each other (default 500m) are grouped;
 * groups with at least `minPoints` (default 5) points become a cluster - * these are what the dashboard shows as an early-warning signal (PRD §6
 * Fase 5: "sinyal peringatan ke dashboard manajemen").
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.MAP_VIEW);

    const { searchParams } = new URL(request.url);
    const radiusMeters = Number(searchParams.get("radiusMeters") ?? 500);
    const minPoints = Number(searchParams.get("minPoints") ?? 5);

    const filters = parseAccidentPointFilters(request);
    const match = buildAccidentPointMatch(filters);

    const docs = await AccidentPoint.find(match)
      .select("location branch city province severity")
      .limit(MAX_POINTS_FOR_CLUSTERING)
      .lean();

    const points = docs.map((d) => ({
      id: d._id.toString(),
      lat: d.location.coordinates[1],
      lng: d.location.coordinates[0],
    }));

    const clusters = detectClusters(
      points,
      isNaN(radiusMeters) ? 500 : radiusMeters,
      isNaN(minPoints) ? 5 : minPoints
    );

    const docById = new Map(docs.map((d) => [d._id.toString(), d]));
    const enriched = clusters.map((c) => {
      const sample = docById.get(c.pointIds[0]);
      return {
        centerLat: c.centerLat,
        centerLng: c.centerLng,
        count: c.count,
        radiusMeters: c.radiusMeters,
        branch: sample?.branch ?? null,
        city: sample?.city ?? null,
        province: sample?.province ?? null,
      };
    });

    return successResponse(enriched, "Sinyal titik rawan kecelakaan (klaster terdeteksi)");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
