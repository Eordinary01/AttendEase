/**
 * INDEXED DB FACE DESCRIPTOR BIOMETRICS CACHING ENGINE
 * 
 * Re-exports core biometric storage utilities and provides
 * Stale-While-Revalidate delta synchronization with the backend API.
 */

import {
  openDB,
  FACE_STORE_NAME,
  validateDescriptor,
  getCachedSectionDescriptors,
  saveDescriptorsToIDB,
  clearTenantFaceCache,
} from './idbStorage';
import api from './api';

export {
  openDB,
  FACE_STORE_NAME,
  validateDescriptor,
  getCachedSectionDescriptors,
  saveDescriptorsToIDB,
  clearTenantFaceCache,
};

/**
 * Stale-While-Revalidate Delta Sync:
 * 1. Checks local cache for section descriptors.
 * 2. In background, calls backend with `?since=<maxUpdatedAt>` to fetch only delta updates.
 * 3. Merges delta changes into IndexedDB and returns fresh list.
 *
 * @param {string} tenantId
 * @param {string} section
 * @param {Object} queryParams - Additional params (courseId, branch, semester)
 * @returns {Promise<{ source: 'cache'|'network'|'merged', data: Array }>}
 */
export const syncSectionDescriptors = async (tenantId, section, queryParams = {}) => {
  if (!tenantId || !section) return { source: 'empty', data: [] };

  // Step 1: Read local cache immediately
  const localCache = await getCachedSectionDescriptors(tenantId, section);

  // Step 2: Prepare background delta fetch
  const params = new URLSearchParams(queryParams);
  if (localCache.maxUpdatedAt && localCache.count > 0) {
    params.set('since', localCache.maxUpdatedAt);
  }

  try {
    const res = await api.get(`/faces/section/${encodeURIComponent(section)}?${params.toString()}`);
    const serverResult = res.data;

    if (serverResult?.success && Array.isArray(serverResult.data)) {
      const isDelta = Boolean(serverResult.isDelta);
      const incoming = serverResult.data;

      if (isDelta) {
        // Delta sync: update modified records in IDB
        if (incoming.length > 0) {
          await saveDescriptorsToIDB(tenantId, section, incoming);
          // Re-fetch all merged records from IDB
          const refreshed = await getCachedSectionDescriptors(tenantId, section);
          return { source: 'merged', data: refreshed.data };
        }
        return { source: 'cache', data: localCache.data };
      } else {
        // Full sync
        if (incoming.length > 0) {
          await saveDescriptorsToIDB(tenantId, section, incoming);
        }
        return { source: 'network', data: incoming };
      }
    }
  } catch (netErr) {
    console.warn('[IDB Biometrics] Network fetch failed, falling back to local IDB cache:', netErr?.message);
  }

  // Network failed or offline — return local cache
  return { source: 'cache', data: localCache.data };
};
