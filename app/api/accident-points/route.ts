import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { parseAccidentPointFilters, buildAccidentPointMatch } from "@/lib/accidentPointFilters";
import { serializeAccidentPoint } from "@/lib/accidentPointSerializer";
import AccidentPoint from "@/models/AccidentPoint";

const MAX_POINTS = 2000;

// Data mock - menunggu integrasi resmi Korlantas Polri (lihat PRD §9).
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    requirePermission(request, PERMISSIONS.MAP_VIEW);

    const filters = parseAccidentPointFilters(request);
    const match = buildAccidentPointMatch(filters);

    let points;
    if (filters.near) {
      // $geoNear must be the first stage of the pipeline - this is the
      // geospatial query MongoDB uses the 2dsphere index for.
      points = await AccidentPoint.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [filters.near.lng, filters.near.lat] },
            distanceField: "distanceMeters",
            maxDistance: filters.near.radiusMeters,
            spherical: true,
            query: match,
          },
        },
        { $limit: MAX_POINTS },
      ]);

      return successResponse(
        points.map((p) => ({
          id: p._id.toString(),
          lat: p.location.coordinates[1],
          lng: p.location.coordinates[0],
          branch: p.branch,
          province: p.province,
          city: p.city,
          accidentDate: p.accidentDate,
          severity: p.severity,
          vehicleType: p.vehicleType,
          casualtyCount: p.casualtyCount,
          description: p.description,
          source: p.source,
          distanceMeters: Math.round(p.distanceMeters),
        })),
        "Titik kecelakaan (data mock, menunggu integrasi Korlantas Polri)"
      );
    }

    const docs = await AccidentPoint.find(match).sort({ accidentDate: -1 }).limit(MAX_POINTS);
    return successResponse(
      docs.map(serializeAccidentPoint),
      "Titik kecelakaan (data mock, menunggu integrasi Korlantas Polri)"
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
