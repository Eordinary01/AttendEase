/**
 * Shared theme utility functions for the Academic Registrar design system.
 * Single source of truth for color manipulation and contrast compliance helpers.
 */

export const DEFAULT_PRIMARY = "#005c55"; // Deep Teal
export const DEFAULT_SECONDARY = "#1d4ed8"; // Cobalt Blue
export const DEFAULT_SURFACE = "#ffffff";
export const DEFAULT_CANVAS = "#fbfbf9";

/**
 * Convert a hex color string to an "R G B" triplet for use in CSS
 * custom properties with alpha support:
 *   color: rgb(var(--color-primary) / 0.5);
 */
export const hexToRgbTriplet = (hex) => {
  if (!hex || typeof hex !== "string") return null;
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6 && clean.length !== 3) return null;
  const fullHex =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return `${r} ${g} ${b}`;
};

/**
 * Convert hex to RGB object { r, g, b }
 */
export const hexToRgb = (hex) => {
  const triplet = hexToRgbTriplet(hex);
  if (!triplet) return { r: 0, g: 92, b: 85 };
  const [r, g, b] = triplet.split(" ").map(Number);
  return { r, g, b };
};

/**
 * Calculate relative luminance of an RGB triplet per WCAG 2.1 specs
 */
export const getLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
};

/**
 * Calculate WCAG contrast ratio between two hex colors (1 to 21)
 */
export const getContrastRatio = (foregroundHex, backgroundHex) => {
  const l1 = getLuminance(foregroundHex);
  const l2 = getLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Lighten (positive percent) or darken (negative percent) a hex color.
 */
export const adjustColor = (hex, percent) => {
  if (!hex || typeof hex !== "string") return hex;
  const clean = hex.replace("#", "").trim();
  const fullHex =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (fullHex.length !== 6) return hex;
  const num = parseInt(fullHex, 16);
  if (Number.isNaN(num)) return hex;
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
};

/**
 * Determine text color (white or dark ink) for content on a given background hex.
 * Guarantees minimum WCAG AA contrast (4.5:1).
 */
export const getOnColor = (bgHex) => {
  const contrastWithWhite = getContrastRatio("#ffffff", bgHex);
  const contrastWithDark = getContrastRatio("#111827", bgHex);
  return contrastWithWhite >= contrastWithDark ? "#ffffff" : "#111827";
};

/**
 * Derive a text-safe primary variant that guarantees WCAG AA (>= 4.5:1)
 * when rendered against the specified surface (default #ffffff).
 */
export const getAccessiblePrimaryInk = (hex, surfaceHex = DEFAULT_SURFACE) => {
  let candidate = hex;
  let ratio = getContrastRatio(candidate, surfaceHex);
  let iterations = 0;
  while (ratio < 4.5 && iterations < 15) {
    candidate = adjustColor(candidate, -8);
    ratio = getContrastRatio(candidate, surfaceHex);
    iterations++;
  }
  return ratio >= 4.5 ? candidate : DEFAULT_PRIMARY;
};

/**
 * Extract standardized theme colors from a tenant branding object or overrides.
 * Strictly adheres to the Academic Registrar color architecture.
 */
export const extractThemeColors = (branding = {}, overrides = {}) => {
  const rawPrimary = overrides.primary || branding.primaryColor || branding.primary || DEFAULT_PRIMARY;
  const rawSecondary = overrides.secondary || branding.secondaryColor || branding.secondary || DEFAULT_SECONDARY;

  const primary = rawPrimary.startsWith("#") ? rawPrimary : `#${rawPrimary}`;
  const secondary = rawSecondary.startsWith("#") ? rawSecondary : `#${rawSecondary}`;

  const onPrimary = getOnColor(primary);
  const onSecondary = getOnColor(secondary);
  const primaryInk = getAccessiblePrimaryInk(primary, DEFAULT_SURFACE);

  return {
    primary,
    secondary,
    onPrimary,
    onSecondary,
    primaryInk,
    hover: adjustColor(primary, -10),
    active: adjustColor(primary, -18),
    dark: adjustColor(primary, -24),
    light: adjustColor(primary, 14),
    soft: adjustColor(primary, 88),
    surface: adjustColor(primary, 82),
    container: adjustColor(primary, -5),
    // Fixed institutional status colors (never overridden by tenant branding)
    status: {
      success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
      error: { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c" },
      warning: { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
      info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
    },
  };
};

