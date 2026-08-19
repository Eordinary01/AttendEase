/**
 * Shared theme utility functions used across components.
 * Single source of truth for color manipulation helpers.
 */

/**
 * Convert a hex color string to an "R G B" triplet for use in CSS
 * custom properties with alpha support:
 *   color: rgb(var(--color-primary) / 0.5);
 */
export const hexToRgbTriplet = (hex) => {
  if (!hex) return null;
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
};

/**
 * Lighten (positive percent) or darken (negative percent) a hex color.
 * Useful for generating hover states, soft backgrounds, etc.
 */
export const adjustColor = (hex, percent) => {
  if (!hex) return hex;
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
};

/**
 * Extract standardized theme colors from a tenant branding object or
 * color overrides. Falls back to sensible defaults.
 */
export const extractThemeColors = (branding = {}, overrides = {}) => {
  const primary = overrides.primary || branding.primary || "#6366f1";
  const secondary = overrides.secondary || branding.secondary || "#8b5cf6";
  return {
    primary,
    secondary,
    light: `${primary}20`,
    lighter: `${primary}10`,
    dark: adjustColor(primary, -14),
    soft: adjustColor(primary, 90),
    surface: adjustColor(primary, 82),
  };
};
