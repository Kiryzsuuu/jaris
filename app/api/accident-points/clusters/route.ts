import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { parseAccidentPointFilters, buildAccidentPointMatch } from "@/lib/accidentPointFilters";
import { detectClusters, computePeakHourWindow, formatHourRange } from "@/lib/accidentClustering";
import { groqChatCompletion, GroqError } from "@/lib/groqClient";
import AccidentPoint from "@/models/AccidentPoint";

const MAX_POINTS_FOR_CLUSTERING = 5000;
// AI recommendation narratives are only generated for the biggest clusters -
// bounds cost/latency and keeps the response fast when there are many.
const MAX_CLUSTERS_NARRATED = 10;

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
      .select("location branch city province severity accidentDate")
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
      const memberDates = c.pointIds
        .map((id) => docById.get(id)?.accidentDate)
        .filter((d): d is Date => d instanceof Date);
      const peak = computePeakHourWindow(memberDates);
      return {
        centerLat: c.centerLat,
        centerLng: c.centerLng,
        count: c.count,
        radiusMeters: c.radiusMeters,
        branch: sample?.branch ?? null,
        city: sample?.city ?? null,
        province: sample?.province ?? null,
        peakHourRange: peak ? formatHourRange(peak) : null,
        peakHourCount: peak?.count ?? null,
        recommendation: null as string | null,
      };
    });

    // AI recommendation for the biggest clusters only - phrased strictly
    // from the already-computed peak hour window, city, and count above.
    // Non-fatal if Groq is unavailable: the deterministic peakHourRange is
    // still returned either way.
    const toNarrate = enriched.filter((c) => c.peakHourRange).slice(0, MAX_CLUSTERS_NARRATED);
    if (toNarrate.length > 0) {
      try {
        const prompt = [
          "Anda adalah analis keselamatan lalu lintas untuk Jasa Raharja. Untuk setiap titik rawan kecelakaan (blackspot) di bawah, tulis SATU kalimat rekomendasi ringkas (Bahasa Indonesia) dalam format: 'Disarankan peningkatan penerangan dan patroli pada pukul <rentang jam>.' - sesuaikan rentang jam dengan data yang diberikan, jangan mengarang jam lain.",
          "",
          ...toNarrate.map(
            (c, i) =>
              `${i + 1}. ${c.city ?? "Wilayah tidak diketahui"} (${c.branch ?? "-"}): ${c.count} kecelakaan tercatat, ${c.peakHourCount} di antaranya terjadi pada rentang pukul ${c.peakHourRange}.`
          ),
          "",
          'Jawab HANYA dalam format JSON: {"recommendations": ["<kalimat untuk item 1>", "<kalimat untuk item 2>", ...]} dengan urutan yang SAMA seperti daftar di atas.',
        ].join("\n");

        const raw = await groqChatCompletion([{ role: "user", content: prompt }], { jsonMode: true, temperature: 0.2 });
        const parsed = JSON.parse(raw) as { recommendations?: string[] };
        if (Array.isArray(parsed.recommendations)) {
          parsed.recommendations.forEach((text, i) => {
            if (toNarrate[i]) toNarrate[i].recommendation = text;
          });
        }
      } catch (error) {
        if (!(error instanceof GroqError)) throw error;
      }
    }

    return successResponse(enriched, "Sinyal titik rawan kecelakaan (klaster terdeteksi)");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
