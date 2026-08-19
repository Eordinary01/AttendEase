import { useContext, useMemo } from "react";
import { ThemeContext } from "../contexts/ThemeContexts";
import { hexToRgbTriplet, adjustColor, extractThemeColors } from "../utils/theme";

/**
 * Hook that provides computed theme colors derived from the current
 * tenant's branding. Returns a stable object with primary, secondary,
 * dark, light, surface, and RGB triplet helpers.
 */
const useThemeColors = () => {
  const ctx = useContext(ThemeContext);
  const branding = ctx?.colors || {};

  const colors = useMemo(() => {
    const extracted = extractThemeColors(branding);
    return {
      ...extracted,
      primaryRgb: hexToRgbTriplet(extracted.primary),
      secondaryRgb: hexToRgbTriplet(extracted.secondary),
      adjustColor,
      hexToRgbTriplet,
    };
  }, [branding.primary, branding.secondary]);

  return colors;
};

export default useThemeColors;
