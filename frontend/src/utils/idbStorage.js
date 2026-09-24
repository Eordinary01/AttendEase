/**
 * INDEXED DB STORAGE UTILITY FOR OFFLINE ATTENDANCE
 * Handles local IndexedDB storage of attendance marks when offline,
 * queue capacity limiting, stale item cleanup, and migration from localStorage.
 */

const DB_NAME = 'AttendEaseOffline';
const DB_VERSION = 2;
const STORE_NAME = 'attendanceQueue';
export const FACE_STORE_NAME = 'faceDescriptors';
const MAX_QUEUE_SIZE = 100; // Cap queue at 100 payloads
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const OLD_STORAGE_KEY = 'attendease_offline_attendance_queue';

let dbInstance = null;

/**
 * Open or initialize IndexedDB connection
 */
export const openDB = () => {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this browser environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Store 1: Offline Attendance Mark Queue
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // Store 2: Client-side Face Biometric Descriptors Cache (Vector-Only)
      if (!db.objectStoreNames.contains(FACE_STORE_NAME)) {
        const faceStore = db.createObjectStore(FACE_STORE_NAME, { keyPath: 'id' });
        faceStore.createIndex('tenantId', 'tenantId', { unique: false });
        faceStore.createIndex('tenantSection', 'tenantSection', { unique: false });
        faceStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error(`Failed to open IndexedDB: ${event.target.error?.message || 'Unknown error'}`));
    };
  });
};

/**
 * Get count of all pending / failed items in the queue
 */
export const getPendingCount = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countReq = store.count();

      countReq.onsuccess = () => resolve(countReq.result || 0);
      countReq.onerror = () => reject(countReq.error);
    });
  } catch (err) {
    console.error('[IDB] Error getting pending count:', err);
    return 0;
  }
};

/**
 * Get all queued items
 */
export const getAllQueueItems = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[IDB] Error fetching all queue items:', err);
    return [];
  }
};

/**
 * Add an attendance payload to the offline IndexedDB queue
 * Enforces MAX_QUEUE_SIZE cap.
 */
export const addToQueue = async (payload) => {
  const db = await openDB();
  const currentCount = await getPendingCount();

  if (currentCount >= MAX_QUEUE_SIZE) {
    throw new Error(`Offline queue is full (maximum ${MAX_QUEUE_SIZE} payloads allowed). Please connect to the internet to sync existing attendance records.`);
  }

  const newItem = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    payload,
    status: 'pending',
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(newItem);

    request.onsuccess = () => resolve(newItem);
    request.onerror = () => reject(new Error(`Failed to save payload: ${request.error?.message}`));
  });
};

/**
 * Update an existing item's status, attempts and error message
 */
export const updateItemStatus = async (id, status, error = null) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) return resolve(null);

        item.status = status;
        item.lastAttemptAt = new Date().toISOString();
        if (status === 'failed') {
          item.attempts = (item.attempts || 0) + 1;
          item.lastError = error;
        }

        const putReq = store.put(item);
        putReq.onsuccess = () => resolve(item);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.error(`[IDB] Failed to update item ${id}:`, err);
  }
};

/**
 * Remove an item from the queue after successful sync
 */
export const removeItem = async (id) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`[IDB] Failed to delete item ${id}:`, err);
    return false;
  }
};

/**
 * Auto-purge items that have failed and are older than 7 days (or general items older than 7 days)
 */
export const purgeStaleItems = async () => {
  try {
    const items = await getAllQueueItems();
    const now = Date.now();
    let purgedCount = 0;

    for (const item of items) {
      const itemAge = now - new Date(item.createdAt).getTime();
      // Purge if older than 7 days
      if (itemAge > STALE_THRESHOLD_MS) {
        await removeItem(item.id);
        purgedCount++;
      }
    }

    if (purgedCount > 0) {
      console.info(`[IDB] Purged ${purgedCount} stale offline attendance payloads (>7 days old).`);
    }
    return purgedCount;
  } catch (err) {
    console.error('[IDB] Failed to purge stale items:', err);
    return 0;
  }
};

/**
 * One-time migration from old localStorage queue to IndexedDB
 */
export const migrateFromLocalStorage = async () => {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (!raw) return 0;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(OLD_STORAGE_KEY);
      return 0;
    }

    const db = await openDB();
    let migratedCount = 0;

    for (const oldItem of parsed) {
      if (oldItem.payload) {
        const itemToSave = {
          id: oldItem.id || `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          payload: oldItem.payload,
          status: 'pending',
          createdAt: oldItem.createdAt || new Date().toISOString(),
          attempts: oldItem.attempts || 0,
          lastError: oldItem.lastError || null,
          lastAttemptAt: null,
        };

        const success = await new Promise((resolve) => {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const req = store.put(itemToSave);
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
        });

        if (success) migratedCount++;
      }
    }

    // Clean up localStorage key after successful migration
    localStorage.removeItem(OLD_STORAGE_KEY);
    console.info(`[IDB] Successfully migrated ${migratedCount} offline payload(s) from localStorage to IndexedDB.`);
    return migratedCount;
  } catch (err) {
    console.error('[IDB] Migration from localStorage failed:', err);
    return 0;
  }
};

/**
 * Clear all items in the queue (e.g. for reset/testing)
 */
export const clearAll = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[IDB] Failed to clear all items:', err);
  }
};

/**
 * Validates that a descriptor is a valid non-empty array of finite floats
 */
export const validateDescriptor = (descriptor) => {
  if (!descriptor) return false;
  if (!Array.isArray(descriptor) && !(descriptor instanceof Float32Array)) return false;
  if (descriptor.length !== 128 && descriptor.length !== 512) return false;
  for (let i = 0; i < descriptor.length; i++) {
    if (!Number.isFinite(descriptor[i])) return false;
  }
  return true;
};

/**
 * Fast read of all cached descriptors for a given tenant and section
 * Returns in ~2-8ms from local browser IndexedDB disk.
 */
export const getCachedSectionDescriptors = async (tenantId, section) => {
  if (!tenantId || !section) return { count: 0, maxUpdatedAt: null, data: [] };

  try {
    const db = await openDB();
    const cleanSection = section.trim().toUpperCase();
    const tenantSectionKey = `${tenantId}_${cleanSection}`;

    return new Promise((resolve) => {
      const transaction = db.transaction([FACE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(FACE_STORE_NAME);
      const index = store.index('tenantSection');
      const req = index.getAll(tenantSectionKey);

      req.onsuccess = () => {
        const records = req.result || [];
        let maxUpdatedAt = null;

        const validList = records
          .filter((rec) => validateDescriptor(rec.descriptor))
          .map((rec) => {
            if (rec.updatedAt && (!maxUpdatedAt || rec.updatedAt > maxUpdatedAt)) {
              maxUpdatedAt = rec.updatedAt;
            }
            return {
              studentId: rec.studentId,
              name: rec.name,
              rollNo: rec.rollNo,
              section: rec.section,
              descriptor: rec.descriptor,
              updatedAt: rec.updatedAt,
            };
          });

        resolve({
          count: validList.length,
          maxUpdatedAt,
          data: validList,
        });
      };

      req.onerror = () => {
        resolve({ count: 0, maxUpdatedAt: null, data: [] });
      };
    });
  } catch (err) {
    console.warn('[IDB Biometrics] Failed to read cached section descriptors:', err);
    return { count: 0, maxUpdatedAt: null, data: [] };
  }
};

/**
 * Upsert face descriptors into IndexedDB cache
 */
export const saveDescriptorsToIDB = async (tenantId, section, descriptors) => {
  if (!tenantId || !section || !Array.isArray(descriptors) || descriptors.length === 0) return 0;

  try {
    const db = await openDB();
    const cleanSection = section.trim().toUpperCase();
    const tenantSectionKey = `${tenantId}_${cleanSection}`;

    let savedCount = 0;
    const transaction = db.transaction([FACE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FACE_STORE_NAME);

    for (const item of descriptors) {
      const rawDescriptor = item.descriptor || item.faceDescriptor;
      if (!validateDescriptor(rawDescriptor)) continue;

      const studentId = item.studentId || item._id || item.id;
      if (!studentId) continue;

      const record = {
        id: `${tenantId}_${studentId}`,
        tenantId: String(tenantId),
        studentId: String(studentId),
        tenantSection: tenantSectionKey,
        section: cleanSection,
        name: item.name || '',
        rollNo: item.rollNo || '',
        descriptor: Array.from(rawDescriptor),
        updatedAt: item.updatedAt || new Date().toISOString(),
      };

      store.put(record);
      savedCount++;
    }

    return savedCount;
  } catch (err) {
    console.warn('[IDB Biometrics] Error saving descriptors to IDB:', err);
    return 0;
  }
};

/**
 * Multi-Tenant Isolation Utility:
 * Completely purges all face descriptors for a tenant when switching institutions or logging out.
 */
export const clearTenantFaceCache = async (tenantId) => {
  if (!tenantId) return 0;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([FACE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(FACE_STORE_NAME);
      const index = store.index('tenantId');
      const req = index.getAllKeys(String(tenantId));

      req.onsuccess = () => {
        const keys = req.result || [];
        keys.forEach((k) => store.delete(k));
        console.info(`[IDB Biometrics] Cleared ${keys.length} biometric vector(s) for tenant ${tenantId}`);
        resolve(keys.length);
      };

      req.onerror = () => resolve(0);
    });
  } catch (err) {
    console.warn('[IDB Biometrics] Error clearing tenant biometric cache:', err);
    return 0;
  }
};
