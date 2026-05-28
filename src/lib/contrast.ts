// WCAG 2.x contrast utilities for the brand color picker. Approximate
// only — uses precomputed surface RGB constants for light + dark mode so
// we don't pull in a full color-space conversion library. Good enough to
// catch obviously bad tenant primary picks (text on the primary CTA, the
// 2 px nav rail visibility, etc.) before they ship.

export const LIGHT_SURFACE_RGB = { r: 255, g: 255, b: 255 };
// Dark --surface = oklch(0.205 0.006 270). Approximated to sRGB by sampling
// the rendered output. Used only for contrast scoring — the actual surface
// is rendered via the CSS variable, not this constant.
export const DARK_SURFACE_RGB = { r: 32, g: 33, b: 39 };

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1] as string, 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function channelLuminance(channel: number): number {
  const norm = channel / 255;
  return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastStatus = "pass" | "warn" | "fail";

// AA thresholds for UI components / large text (3:1 minimum). We grade
// `warn` at the 2:1-3:1 band because the tenant primary is used as a 2 px
// rail and as the chart-series-1 stroke — a 2:1 contrast renders, but
// only barely; at <2:1 the rail disappears against the surface.
export function contrastStatusAgainst(primary: Rgb, surface: Rgb): ContrastStatus {
  const ratio = contrastRatio(primary, surface);
  if (ratio >= 3) return "pass";
  if (ratio >= 2) return "warn";
  return "fail";
}

export type BrandContrast = {
  light: ContrastStatus;
  dark: ContrastStatus;
  lightRatio: number;
  darkRatio: number;
};

export function evaluateBrandContrast(hex: string): BrandContrast | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return {
    light: contrastStatusAgainst(rgb, LIGHT_SURFACE_RGB),
    dark: contrastStatusAgainst(rgb, DARK_SURFACE_RGB),
    lightRatio: contrastRatio(rgb, LIGHT_SURFACE_RGB),
    darkRatio: contrastRatio(rgb, DARK_SURFACE_RGB),
  };
}
