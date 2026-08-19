// src/contexts/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { logError } from '../utils/logger';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [tenantColors, setTenantColors] = useState({
    primary: '#6366f1',    // Default indigo
    secondary: '#8b5cf6',  // Default purple
    accent: '#4f46e5',     // Default dark indigo
    background: '#f3f4f6', // Default gray
    text: '#1f2937',       // Default dark
  });
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('token'));

  // Re-fetch branding whenever the auth token changes (login, logout,
  // tenant switch, token expiry) instead of only on first mount.
  useEffect(() => {
    const syncToken = () => setAuthToken(localStorage.getItem('token'));
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
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return null;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `${r} ${g} ${b}`;
  };

  const adjustColor = (hex, percent) => {
    if (!hex) return hex;
    // Helper to lighten/darken hex colors
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
  };

  const applyThemeColors = useCallback((colors) => {
    const root = document.documentElement;
    const primary = colors.primary || '#6366f1';
    const secondary = colors.secondary || '#8b5cf6';
    const accent = colors.accent || '#4f46e5';

    const setVar = (name, hex, fallback) => {
      const triplet = toRgbTriplet(hex) || toRgbTriplet(fallback);
      root.style.setProperty(name, triplet);
    };

    setVar('--color-primary', primary, '#6366f1');
    setVar('--color-primary-light', adjustColor(primary, 8), '#818cf8');
    setVar('--color-primary-dark', adjustColor(primary, -14), '#4338ca');
    setVar('--color-primary-soft', adjustColor(primary, 90), '#eef2ff');
    setVar('--color-primary-surface', adjustColor(primary, 82), '#e0e7ff');
    setVar('--color-secondary', secondary, '#8b5cf6');
    setVar('--color-secondary-light', adjustColor(secondary, 8), '#a78bfa');
    setVar('--color-secondary-dark', adjustColor(secondary, -14), '#6d28d9');
    setVar('--color-secondary-soft', adjustColor(secondary, 90), '#f5f3ff');
    setVar('--color-secondary-surface', adjustColor(secondary, 82), '#ede9fe');
    setVar('--color-accent', accent, '#4f46e5');

    // Update meta theme color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.content = primary;
    }
  }, []);

  const fetchTenantBranding = async () => {
    try {
      const token = localStorage.getItem('token');
      // Unauthenticated users or users on login/public routes do not need protected tenant info
      if (!token || window.location.pathname.startsWith('/login')) {
        applyThemeColors({ primary: '#6366f1', secondary: '#8b5cf6', accent: '#4f46e5' });
        setLoading(false);
        return;
      }

      // Super admins are platform-level — keep default branding, never a tenant's
      if (localStorage.getItem('role') === 'super_admin') {
        applyThemeColors({ primary: '#6366f1', secondary: '#8b5cf6', accent: '#4f46e5' });
        setLoading(false);
        return;
      }

      const response = await api.get('/tenant/info');

      if (response.data.success) {
        const branding = response.data.data.tenant?.branding;
        if (branding) {
          const colors = {
            primary: branding.primaryColor || '#6366f1',
            secondary: branding.secondaryColor || '#8b5cf6',
            accent: branding.accentColor || '#4f46e5',
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
          primaryColor: colors.primary,
          secondaryColor: colors.secondary,
          accentColor: colors.accent,
        }
      });

      if (response.data.success) {
        setTenantColors({
          ...tenantColors,
          ...colors
        });
        applyThemeColors(colors);
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
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
