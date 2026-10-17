import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { logError } from '../utils/logger';
import { fetchTenantInfo, getCachedTenantBranding, clearCachedTenantBranding } from '../utils/tenantService';
import {
  extractThemeColors,
  hexToRgbTriplet,
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
  DEFAULT_CANVAS,
  DEFAULT_SURFACE,
} from '../utils/theme';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const getInitialColors = () => {
    const cached = getCachedTenantBranding();
    if (cached?.branding?.primaryColor) {
      return {
        primary: cached.branding.primaryColor || DEFAULT_PRIMARY,
        secondary: cached.branding.secondaryColor || DEFAULT_SECONDARY,
        accent: cached.branding.accentColor || DEFAULT_PRIMARY,
        background: cached.branding.backgroundColor || DEFAULT_CANVAS,
        text: cached.branding.textColor || '#111827',
      };
    }
    return {
      primary: DEFAULT_PRIMARY,
      secondary: DEFAULT_SECONDARY,
      accent: DEFAULT_PRIMARY,
      background: DEFAULT_CANVAS,
      text: '#111827',
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

  const applyThemeColors = useCallback((colors) => {
    const root = document.documentElement;
    const extracted = extractThemeColors(colors);

    const setVar = (name, hex, fallback) => {
      const triplet = hexToRgbTriplet(hex) || hexToRgbTriplet(fallback);
      if (triplet) {
        root.style.setProperty(name, triplet);
      }
    };

    setVar('--color-primary', extracted.primary, DEFAULT_PRIMARY);
    setVar('--color-primary-hover', extracted.hover, '#115e59');
    setVar('--color-primary-active', extracted.active, '#134e4a');
    setVar('--color-primary-light', extracted.light, '#0f766e');
    setVar('--color-primary-dark', extracted.dark, '#003c37');
    setVar('--color-primary-soft', extracted.soft, '#f0fdfa');
    setVar('--color-primary-surface', extracted.surface, '#ccfbf1');
    setVar('--color-primary-container', extracted.container, '#0f766e');
    setVar('--color-primary-ink', extracted.primaryInk, DEFAULT_PRIMARY);
    setVar('--color-on-primary', extracted.onPrimary, '#ffffff');

    setVar('--color-secondary', extracted.secondary, DEFAULT_SECONDARY);
    setVar('--color-secondary-light', extracted.light, '#4069f2');
    setVar('--color-secondary-dark', extracted.dark, '#1e3a8a');
    setVar('--color-secondary-soft', extracted.soft, '#eff6ff');
    setVar('--color-secondary-surface', extracted.surface, '#dbeafe');
    setVar('--color-secondary-container', extracted.container, '#4069f2');
    setVar('--color-on-secondary', extracted.onSecondary, '#ffffff');

    setVar('--color-accent', extracted.primary, DEFAULT_PRIMARY);

    // Update meta theme color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.content = extracted.primary;
    }
  }, []);

  const fetchTenantBranding = async () => {
    try {
      const hasAuth = localStorage.getItem('userId') || localStorage.getItem('token');
      if (!hasAuth || window.location.pathname.startsWith('/login')) {
        // Do not force DEFAULT_PRIMARY if visiting a specific tenant subdomain route (/login/:subdomain)
        // because NewLogin dynamically retrieves and activates the tenant's custom branding if their plan includes it.
        const isTenantLogin = window.location.pathname.startsWith('/login/') && window.location.pathname !== '/login/';
        if (!isTenantLogin) {
          applyThemeColors({ primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY });
        }
        setLoading(false);
        return;
      }

      // Super admins are platform-level — keep default branding, never a tenant's
      if (localStorage.getItem('role') === 'super_admin') {
        applyThemeColors({ primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY });
        setLoading(false);
        return;
      }

      // Instant hydration from cache
      const cached = getCachedTenantBranding();
      if (cached?.branding) {
        const colors = {
          primary: cached.branding.primaryColor || DEFAULT_PRIMARY,
          secondary: cached.branding.secondaryColor || DEFAULT_SECONDARY,
          accent: cached.branding.accentColor || DEFAULT_PRIMARY,
          background: cached.branding.backgroundColor || DEFAULT_CANVAS,
          text: cached.branding.textColor || '#111827',
        };
        setTenantColors(colors);
        applyThemeColors(colors);
      }

      const response = await fetchTenantInfo();

      if (response.data?.success) {
        const branding = response.data.data?.tenant?.branding;
        if (branding) {
          const colors = {
            primary: branding.primaryColor || DEFAULT_PRIMARY,
            secondary: branding.secondaryColor || DEFAULT_SECONDARY,
            accent: branding.accentColor || DEFAULT_PRIMARY,
            background: branding.backgroundColor || DEFAULT_CANVAS,
            text: branding.textColor || '#111827',
          };
          setTenantColors(colors);
          applyThemeColors(colors);
        }
      }
    } catch (error) {
      // Fall back to defaults if branding can't be fetched
      applyThemeColors({ primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY });
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
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
