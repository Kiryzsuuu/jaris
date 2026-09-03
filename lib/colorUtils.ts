const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;

export interface ThemeColorShades {
  base: string;
  hover: string;
  translucent: string;
  /** Readable foreground color (near-black or near-white) for text placed on `base`. */
  foreground: string;
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

/**
 * Derives the accent-color shades the template's CSS variables need
 * (--brand-lime / --brand-lime-hover / --brand-lime-translucent) from a
 * single admin-chosen hex color. Pure function, no DOM - safe to call on
 * the server for a zero-flash inline <style> override, and unit-testable.
 */
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
