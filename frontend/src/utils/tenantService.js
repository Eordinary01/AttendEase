import api from './api';

const BRANDING_CACHE_KEY = 'attendease:tenant_branding';
const BRANDING_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let inFlightPromise = null;

export const getCachedTenantBranding = () => {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > BRANDING_CACHE_TTL_MS) {
      localStorage.removeItem(BRANDING_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
};

export const clearCachedTenantBranding = () => {
  try {
    localStorage.removeItem(BRANDING_CACHE_KEY);
  } catch (e) {}
};

export const fetchTenantInfo = (options = {}) => {
  const { force = false } = options;

  if (inFlightPromise && !force) {
    return inFlightPromise;
  }

  inFlightPromise = api.get('/tenant/info')
    .then((response) => {
      if (response.data?.success && response.data?.data?.tenant) {
        const tenant = response.data.data.tenant;
        try {
          const cachePayload = {
            tenantId: tenant._id,
            name: tenant.name,
            subdomain: tenant.subdomain,
            branding: tenant.branding || {},
            timestamp: Date.now()
          };
          localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(cachePayload));
        } catch (e) {
          // ignore localStorage quota errors
        }
      }
      return response;
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
};

let inFlightUsagePromise = null;

export const fetchTenantUsage = (options = {}) => {
  const { force = false } = options;

  if (inFlightUsagePromise && !force) {
    return inFlightUsagePromise;
  }

  inFlightUsagePromise = api.get('/tenant/usage')
    .finally(() => {
      inFlightUsagePromise = null;
    });

  return inFlightUsagePromise;
};

const tenantService = {
  fetchTenantInfo,
  fetchTenantUsage,
  getCachedTenantBranding,
  clearCachedTenantBranding
};

export default tenantService;


