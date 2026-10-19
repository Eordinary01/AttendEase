/**
 * activeTenant.js
 * Utility to manage the active and recently accessed tenant/campus portals
 * for seamless user walkthrough, campus switching, and direct logins.
 */

const ACTIVE_TENANT_KEY = 'activeTenant';
const SUBDOMAIN_KEY = 'tenantSubdomain';
const RECENT_TENANTS_KEY = 'recentTenants';

/**
 * Get the currently remembered active tenant
 * @returns {{ subdomain: string, name: string, logo?: string, primaryColor?: string } | null}
 */
export const getActiveTenant = () => {
  try {
    const raw = localStorage.getItem(ACTIVE_TENANT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.subdomain) return parsed;
    }

    // Fallback: check legacy subdomain key
    const subdomain = localStorage.getItem(SUBDOMAIN_KEY);
    if (subdomain && subdomain !== 'demo') {
      const tenantName = localStorage.getItem('tenantName') || subdomain;
      return {
        subdomain,
        name: tenantName,
      };
    }
  } catch (err) {
    console.warn('Failed to parse active tenant from storage:', err);
  }
  return null;
};

/**
 * Set the current active tenant and record it in recent campuses list
 * @param {{ subdomain: string, name?: string, logo?: string, primaryColor?: string }} tenant
 */
export const setActiveTenant = (tenant) => {
  if (!tenant || !tenant.subdomain) return;
  try {
    const cleanTenant = {
      subdomain: tenant.subdomain.trim().toLowerCase(),
      name: tenant.name || tenant.subdomain,
      logo: tenant.logo || null,
      primaryColor: tenant.primaryColor || null,
      lastVisited: Date.now(),
    };

    localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(cleanTenant));
    localStorage.setItem(SUBDOMAIN_KEY, cleanTenant.subdomain);

    // Update recent tenants (max 5)
    const recents = getRecentTenants().filter((t) => t.subdomain !== cleanTenant.subdomain);
    recents.unshift(cleanTenant);
    localStorage.setItem(RECENT_TENANTS_KEY, JSON.stringify(recents.slice(0, 5)));
  } catch (err) {
    console.warn('Failed to store active tenant:', err);
  }
};

/**
 * Get list of recently visited campuses
 * @returns {Array<{ subdomain: string, name: string, logo?: string, primaryColor?: string }>}
 */
export const getRecentTenants = () => {
  try {
    const raw = localStorage.getItem(RECENT_TENANTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse recent tenants from storage:', err);
  }
  return [];
};

/**
 * Clear the current active tenant
 */
export const clearActiveTenant = () => {
  try {
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    localStorage.removeItem(SUBDOMAIN_KEY);
    localStorage.removeItem('tenantName');
    localStorage.removeItem('attendease:tenant_branding');
  } catch (err) {
    console.warn('Failed to clear active tenant:', err);
  }
};

/**
 * Remove a specific tenant from recent campuses list
 * @param {string} subdomain
 */
export const removeRecentTenant = (subdomain) => {
  if (!subdomain) return;
  try {
    const cleanSub = subdomain.trim().toLowerCase();
    const recents = getRecentTenants().filter((t) => t.subdomain?.toLowerCase() !== cleanSub);
    localStorage.setItem(RECENT_TENANTS_KEY, JSON.stringify(recents));

    // If removing the active tenant, also clear active tenant storage
    const active = getActiveTenant();
    if (active && active.subdomain?.toLowerCase() === cleanSub) {
      clearActiveTenant();
    }
  } catch (err) {
    console.warn('Failed to remove recent tenant:', err);
  }
};

/**
 * Clear all cached campus and tenant data
 */
export const clearAllTenantCaches = () => {
  clearActiveTenant();
  try {
    localStorage.removeItem(RECENT_TENANTS_KEY);
  } catch (err) {
    console.warn('Failed to clear recent tenants:', err);
  }
};

/**
 * Get direct walkthrough login URL for a given campus subdomain
 * @param {string} subdomain
 * @returns {string}
 */
export const getTenantLoginUrl = (subdomain) => {
  if (!subdomain) return '/login';
  return `/login/${encodeURIComponent(subdomain.toLowerCase())}`;
};

/**
 * Get full external URL for sharing/copying
 * @param {string} subdomain
 * @returns {string}
 */
export const getFullTenantUrl = (subdomain) => {
  const origin = window.location.origin;
  return `${origin}${getTenantLoginUrl(subdomain)}`;
};
