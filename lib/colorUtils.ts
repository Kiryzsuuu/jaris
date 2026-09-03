const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;

export interface ThemeColorShades {
  base: string;
  hover: string;
  translucent: string;
  /** Readable foreground color (near-black or near-white) for text placed on `base`. */
  foreground: string;
}

export interface TailwindColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = HEX_PATTERN.exec(hex);
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lighten([r, g, b]: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ];
}

function darken([r, g, b]: [number, number, number], amount: number): [number, number, number] {
  return [Math.round(r * (1 - amount)), Math.round(g * (1 - amount)), Math.round(b * (1 - amount))];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rl, gl, bl] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

const DEFAULT_SCALE: TailwindColorScale = {
  50: "#eef2ff",
  100: "#e0e7ff",
  200: "#c7d2fe",
  300: "#a5b4fc",
  400: "#818cf8",
  500: "#6366f1",
  600: "#4f46e5",
  700: "#4338ca",
  800: "#3730a3",
  900: "#312e81",
  950: "#1e1b4b",
};

/**
 * Derives a full Tailwind-style 50-950 tint/shade scale from a single
 * admin-chosen hex color (the "500" stop), by lightening toward white for
 * 50-400 and darkening toward black for 600-950. Good enough perceptually
 * for UI chrome (buttons, badges, active states) without needing a full
 * OKLCH color-science library. Pure function - safe on the server, and
 * directly unit-testable.
 */
export function deriveColorScale(hex: string): TailwindColorScale {
  const rgb = hexToRgb(hex);
  if (!rgb) return DEFAULT_SCALE;

  return {
    50: toHex(lighten(rgb, 0.94)),
    100: toHex(lighten(rgb, 0.85)),
    200: toHex(lighten(rgb, 0.7)),
    300: toHex(lighten(rgb, 0.5)),
    400: toHex(lighten(rgb, 0.25)),
    500: hex,
    600: toHex(darken(rgb, 0.18)),
    700: toHex(darken(rgb, 0.35)),
    800: toHex(darken(rgb, 0.52)),
    900: toHex(darken(rgb, 0.68)),
    950: toHex(darken(rgb, 0.82)),
  };
}

/** @deprecated kept for the Spark Admin theming path; new UI uses deriveColorScale(). */
export function deriveThemeShades(hex: string): ThemeColorShades {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return {
      base: "#B4F105",
      hover: "#c1f824",
      translucent: "rgba(180, 241, 5, 0.15)",
      foreground: "#051C12",
    };
  }

  const hover = toHex(lighten(rgb, 0.12));
  const translucent = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.15)`;
  const foreground = relativeLuminance(rgb) > 0.5 ? "#051C12" : "#FFFFFF";

  return { base: hex, hover, translucent, foreground };
}
