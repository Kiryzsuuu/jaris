import {
  ACCIDENT_SEVERITIES,
  ACCIDENT_VEHICLE_TYPES,
  type AccidentSeverity,
  type AccidentVehicleType,
} from "@/models/AccidentPoint";

export interface RegionSeed {
  branch: string;
  province: string;
  city: string;
  centerLat: number;
  centerLng: number;
}

// Rough city-center coordinates - good enough for mock/demo data.
export const REGION_SEEDS: RegionSeed[] = [
  { branch: "Cabang Jakarta", province: "DKI Jakarta", city: "Jakarta", centerLat: -6.2088, centerLng: 106.8456 },
  { branch: "Cabang Bandung", province: "Jawa Barat", city: "Bandung", centerLat: -6.9175, centerLng: 107.6191 },
  { branch: "Cabang Surabaya", province: "Jawa Timur", city: "Surabaya", centerLat: -7.2575, centerLng: 112.7521 },
  { branch: "Cabang Semarang", province: "Jawa Tengah", city: "Semarang", centerLat: -6.9932, centerLng: 110.4203 },
  { branch: "Cabang Yogyakarta", province: "DI Yogyakarta", city: "Yogyakarta", centerLat: -7.7956, centerLng: 110.3695 },
  { branch: "Cabang Medan", province: "Sumatera Utara", city: "Medan", centerLat: 3.5952, centerLng: 98.6722 },
  { branch: "Cabang Palembang", province: "Sumatera Selatan", city: "Palembang", centerLat: -2.9761, centerLng: 104.7754 },
  { branch: "Cabang Makassar", province: "Sulawesi Selatan", city: "Makassar", centerLat: -5.1477, centerLng: 119.4327 },
  { branch: "Cabang Denpasar", province: "Bali", city: "Denpasar", centerLat: -8.6705, centerLng: 115.2126 },
  { branch: "Cabang Balikpapan", province: "Kalimantan Timur", city: "Balikpapan", centerLat: -1.2379, centerLng: 116.8529 },
];

const DESCRIPTIONS = [
  "Tabrakan beruntun di persimpangan padat",
  "Kendaraan tergelincir saat hujan deras",
  "Tabrak lari, korban ditemukan warga sekitar",
  "Sepeda motor tertabrak angkutan umum",
  "Kecelakaan tunggal, kendaraan menabrak median jalan",
  "Truk terguling akibat rem blong",
  "Pejalan kaki tertabrak saat menyeberang",
  "Tabrakan adu banteng dua kendaraan roda dua",
  "Kecelakaan beruntun akibat jarak aman tidak terjaga",
  "Kendaraan keluar jalur di tikungan tajam",
];

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateWithinLastMonths(months: number): Date {
  const now = Date.now();
  const past = now - months * 30 * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

/** ~1 degree latitude ≈ 111,320m; jitter in meters converted to degrees. */
function jitterCoords(lat: number, lng: number, maxMeters: number): { lat: number; lng: number } {
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * maxMeters;
  const dLat = (distance * Math.cos(angle)) / 111320;
  const dLng = (distance * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

export interface AccidentPointSeedRecord {
  branch: string;
  province: string;
  city: string;
  lat: number;
  lng: number;
  accidentDate: Date;
  severity: AccidentSeverity;
  vehicleType: AccidentVehicleType;
  casualtyCount: number;
  description: string;
}

function buildPoint(region: RegionSeed, lat: number, lng: number): AccidentPointSeedRecord {
  const severity = randomChoice(ACCIDENT_SEVERITIES);
  return {
    branch: region.branch,
    province: region.province,
    city: region.city,
    lat,
    lng,
    accidentDate: randomDateWithinLastMonths(12),
    severity,
    vehicleType: randomChoice(ACCIDENT_VEHICLE_TYPES),
    casualtyCount: severity === "meninggal_dunia" ? randomInt(1, 3) : randomInt(0, 2),
    description: randomChoice(DESCRIPTIONS),
  };
}

/**
 * Generates mock accident points per region: a few deliberate "blackspot"
 * clusters (tight radius, several points each - so cluster detection has
 * something real to find) plus scattered points across the wider city area.
 */
export function generateMockAccidentPoints(): AccidentPointSeedRecord[] {
  const points: AccidentPointSeedRecord[] = [];

  for (const region of REGION_SEEDS) {
    const clusterCount = randomInt(1, 2);
    for (let c = 0; c < clusterCount; c++) {
      const clusterCenter = jitterCoords(region.centerLat, region.centerLng, 8000);
      const pointsInCluster = randomInt(6, 12);
      for (let i = 0; i < pointsInCluster; i++) {
        const { lat, lng } = jitterCoords(clusterCenter.lat, clusterCenter.lng, 200);
        points.push(buildPoint(region, lat, lng));
      }
    }

    const scatteredCount = randomInt(15, 25);
    for (let i = 0; i < scatteredCount; i++) {
      const { lat, lng } = jitterCoords(region.centerLat, region.centerLng, 15000);
      points.push(buildPoint(region, lat, lng));
    }
  }

  return points;
}
