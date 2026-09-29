// src/contexts/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { logError } from '../utils/logger';
import { fetchTenantInfo, getCachedTenantBranding, clearCachedTenantBranding } from '../utils/tenantService';

export const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const getInitialColors = () => {
    const cached = getCachedTenantBranding();
    if (cached?.branding?.primaryColor) {
      return {
        primary: cached.branding.primaryColor || '#6366f1',
        secondary: cached.branding.secondaryColor || '#8b5cf6',
        accent: cached.branding.accentColor || '#4f46e5',
        background: cached.branding.backgroundColor || '#f3f4f6',
        text: cached.branding.textColor || '#1f2937',
      };
    }
    return {
      primary: '#6366f1',    // Default indigo
      secondary: '#8b5cf6',  // Default purple
      accent: '#4f46e5',     // Default dark indigo
      background: '#f3f4f6', // Default gray
      text: '#1f2937',       // Default dark
    };
  };

  const [tenantColors, setTenantColors] = useState(getInitialColors);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('userId') || localStorage.getItem('token'));

  // Re-fetch branding whenever auth state changes (login, logout,
  // tenant switch, token expiry) instead of only on first mount.
  useEffect(() => {
    const syncToken = () => setAuthToken(localStorage.getItem('userId') || localStorage.getItem('token'));
    window.addEventListener('storage', syncToken);
    window.addEventListener('attendease:auth-changed', syncToken);
    return () => {
      window.removeEventListener('storage', syncToken);
      window.removeEventListener('attendease:auth-changed', syncToken);
    };
  }, []);

  useEffect(() => {
    fetchTenantBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  // Helper to convert hex to "R G B" triplet (used by CSS var tokens)
  const toRgbTriplet = (hex) => {
    if (!hex) return null;
    const clean = hex.replace('#', '').trim();
    if (clean.length !== 6) return null;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return `${r} ${g} ${b}`;
  };

  const adjustColor = (hex, percent) => {
    if (!hex) return hex;
    const clean = hex.replace('#', '').trim();
    if (clean.length !== 6) return hex;
    const num = parseInt(clean, 16);
    if (isNaN(num)) return hex;
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;

    if (percent > 0) {
      // Lighten towards pure white (#ffffff) smoothly
      const factor = percent / 100;
      const R = Math.min(255, Math.max(0, Math.round(r + (255 - r) * factor)));
      const G = Math.min(255, Math.max(0, Math.round(g + (255 - g) * factor)));
      const B = Math.min(255, Math.max(0, Math.round(b + (255 - b) * factor)));
      return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
    } else {
      // Darken towards black smoothly
      const factor = 1 + (percent / 100);
      const R = Math.min(255, Math.max(0, Math.round(r * factor)));
      const G = Math.min(255, Math.max(0, Math.round(g * factor)));
      const B = Math.min(255, Math.max(0, Math.round(b * factor)));
      return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
    }
  };

  const applyThemeColors = useCallback((colors) => {
    if (!colors) return;
    const root = document.documentElement;
    const primary = colors.primary || colors.primaryColor || '#6366f1';
    const secondary = colors.secondary || colors.secondaryColor || '#8b5cf6';
    const accent = colors.accent || colors.accentColor || '#4f46e5';

    const setVar = (name, hex, fallback) => {
      const triplet = toRgbTriplet(hex) || toRgbTriplet(fallback);
      if (triplet) {
        root.style.setProperty(name, triplet);
      }
    };

    setVar('--color-primary', primary, '#6366f1');
    setVar('--color-primary-light', adjustColor(primary, 20), '#818cf8');
    setVar('--color-primary-dark', adjustColor(primary, -15), '#4338ca');
    setVar('--color-primary-soft', adjustColor(primary, 90), '#eef2ff');
    setVar('--color-primary-surface', adjustColor(primary, 80), '#e0e7ff');
    setVar('--color-secondary', secondary, '#8b5cf6');
    setVar('--color-secondary-light', adjustColor(secondary, 20), '#a78bfa');
    setVar('--color-secondary-dark', adjustColor(secondary, -15), '#6d28d9');
    setVar('--color-secondary-soft', adjustColor(secondary, 90), '#f5f3ff');
    setVar('--color-secondary-surface', adjustColor(secondary, 80), '#ede9fe');
    setVar('--color-accent', accent, '#4f46e5');

    // Also set direct hex variables for standard CSS & SVG rules
    root.style.setProperty('--theme-primary', primary);
    root.style.setProperty('--theme-secondary', secondary);
    root.style.setProperty('--header-primary', primary);
    root.style.setProperty('--header-secondary', secondary);

    // Update meta theme color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.content = primary;
    }
  }, []);

  const fetchTenantBranding = async () => {
    try {
      const hasAuth = localStorage.getItem('userId') || localStorage.getItem('token');

      // Super admins are platform-level — keep default platform branding
      if (localStorage.getItem('role') === 'super_admin') {
        const platformDefaults = { primary: '#6366f1', secondary: '#8b5cf6', accent: '#4f46e5' };
        setTenantColors(platformDefaults);
        applyThemeColors(platformDefaults);
        setLoading(false);
        return;
      }

      // Check instant hydration from cache
      const cached = getCachedTenantBranding();
      if (cached?.branding && (cached.branding.primaryColor || cached.branding.primary)) {
        const colors = {
          primary: cached.branding.primaryColor || cached.branding.primary || '#6366f1',
          secondary: cached.branding.secondaryColor || cached.branding.secondary || '#8b5cf6',
          accent: cached.branding.accentColor || cached.branding.accent || '#4f46e5',
          background: cached.branding.backgroundColor || '#f3f4f6',
          text: cached.branding.textColor || '#1f2937',
        };
        setTenantColors(colors);
        applyThemeColors(colors);
      }

      if (!hasAuth) {
        setLoading(false);
        return;
      }

      const response = await fetchTenantInfo();

      if (response.data?.success) {
        const branding = response.data.data?.tenant?.branding;
        if (branding && (branding.primaryColor || branding.primary)) {
          const colors = {
            primary: branding.primaryColor || branding.primary || '#6366f1',
            secondary: branding.secondaryColor || branding.secondary || '#8b5cf6',
            accent: branding.accentColor || branding.accent || '#4f46e5',
            background: branding.backgroundColor || '#f3f4f6',
            text: branding.textColor || '#1f2937',
          };
          setTenantColors(colors);
          applyThemeColors(colors);
        }
      }
    } catch (error) {
      // Fall back to defaults if branding can't be fetched
      applyThemeColors({ primary: '#6366f1', secondary: '#8b5cf6', accent: '#4f46e5' });
    } finally {
      setLoading(false);
    }
  };

  const updateTheme = async (colors) => {
    try {
      const response = await api.put('/tenant/settings', {
        branding: {
          primaryColor: colors.primary || colors.primaryColor,
          secondaryColor: colors.secondary || colors.secondaryColor,
          accentColor: colors.accent || colors.accentColor,
        }
      });

      if (response.data.success) {
        clearCachedTenantBranding();
        const mergedColors = {
          ...tenantColors,
          ...colors
        };
        setTenantColors(mergedColors);
        applyThemeColors(mergedColors);
        return true;
      }
      return false;
    } catch (error) {
      logError("Update Theme", error);
      return false;
    }
  };

  return (
    <ThemeContext.Provider value={{
      colors: tenantColors,
      loading,
      updateTheme,
      applyThemeColors,
      refreshTheme: fetchTenantBranding,
      toRgbTriplet,
      adjustColor,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
