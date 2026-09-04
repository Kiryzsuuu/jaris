const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

// WMO weather codes (https://open-meteo.com/en/docs) collapsed to the
// handful of conditions relevant for an accident-risk read.
const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Cerah",
  1: "Cerah berawan",
  2: "Berawan sebagian",
  3: "Mendung",
  45: "Berkabut",
  48: "Berkabut (embun beku)",
  51: "Gerimis ringan",
  53: "Gerimis",
  55: "Gerimis lebat",
  61: "Hujan ringan",
  63: "Hujan",
  65: "Hujan lebat",
  80: "Hujan lokal",
  81: "Hujan lokal lebat",
  82: "Hujan lokal sangat lebat",
  95: "Badai petir",
  96: "Badai petir dengan hujan es",
  99: "Badai petir dengan hujan es lebat",
};

// Weathercodes that meaningfully increase driving risk (rain, fog, storms).
const HAZARDOUS_WEATHER_CODES = new Set([45, 48, 51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);

export type WeatherReading = {
  condition: string;
  weatherCode: number;
  precipitationMm: number;
  temperatureC: number;
  isHazardous: boolean;
  source: "forecast" | "archive";
};

type OpenMeteoHourlyResponse = {
  hourly?: {
    time: string[];
    precipitation: number[];
    weathercode: number[];
    temperature_2m: number[];
  };
};

function pickClosestHourIndex(times: string[], target: Date): number {
  let bestIndex = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - target.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }
  return bestIndex;
}

async function fetchHourly(url: string, lat: number, lng: number, date: Date): Promise<OpenMeteoHourlyResponse | null> {
  const dateStr = date.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    start_date: dateStr,
    end_date: dateStr,
    hourly: "precipitation,weathercode,temperature_2m",
    timezone: "Asia/Jakarta",
  });

  const response = await fetch(`${url}?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  return (await response.json()) as OpenMeteoHourlyResponse;
}

/**
 * Real weather for a location/time, used as one (minor) input to the
 * accident-risk score - never the dominant factor. Open-Meteo is free and
 * needs no API key. Forecast data only covers roughly "today +/- a couple
 * weeks"; anything outside that range falls back to the historical archive
 * endpoint. This never throws - a failed/unavailable lookup just means the
 * risk score proceeds without a weather adjustment, which the UI surfaces
 * honestly ("cuaca tidak tersedia untuk tanggal ini") rather than guessing.
 */
export async function getWeatherReading(lat: number, lng: number, dateTime: Date): Promise<WeatherReading | null> {
  const now = Date.now();
  const diffDays = (dateTime.getTime() - now) / 86_400_000;
  // Forecast API covers a small past window (via past_days) and ~16 days
  // ahead; outside that, only the archive API (past dates only) can help.
  const useForecast = diffDays >= -5 && diffDays <= 15;
  const useArchive = !useForecast && diffDays < -5;
  if (!useForecast && !useArchive) return null; // too far in the future - genuinely unavailable

  try {
    const raw = await fetchHourly(useForecast ? FORECAST_URL : ARCHIVE_URL, lat, lng, dateTime);
    const hourly = raw?.hourly;
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) return null;

    const index = pickClosestHourIndex(hourly.time, dateTime);
    const weatherCode = hourly.weathercode?.[index];
    if (typeof weatherCode !== "number") return null;

    return {
      condition: WEATHER_CODE_LABELS[weatherCode] ?? "Tidak diketahui",
      weatherCode,
      precipitationMm: hourly.precipitation?.[index] ?? 0,
      temperatureC: hourly.temperature_2m?.[index] ?? 0,
      isHazardous: HAZARDOUS_WEATHER_CODES.has(weatherCode),
      source: useForecast ? "forecast" : "archive",
    };
  } catch {
    // Network hiccup, timeout, or unexpected shape - degrade gracefully.
    return null;
  }
}
