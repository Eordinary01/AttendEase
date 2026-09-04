/**
 * OFFLINE ATTENDANCE SYNC ORCHESTRATOR
 * Coordinates IndexedDB offline persistence, background Web Worker synchronization,
 * exponential backoff, auto-reconnection synchronization, and event broadcasting.
 */

import {
  openDB,
  addToQueue as idbAddToQueue,
  getPendingCount as idbGetPendingCount,
  getAllQueueItems as idbGetAllQueueItems,
  removeItem as idbRemoveItem,
  updateItemStatus as idbUpdateItemStatus,
  migrateFromLocalStorage,
  purgeStaleItems,
  clearAll as idbClearAll,
} from './idbStorage';

let syncWorker = null;
const syncListeners = new Set();
let isInitialized = false;

/**
 * Broadcast an event to all registered UI subscribers
 */
const broadcast = (event) => {
  syncListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (e) {
      console.error('[OfflineSync] Error in listener callback:', e);
    }
  });
};

/**
 * Initialize IndexedDB, migrate old localStorage data, auto-purge stale items,
 * spawn the background Web Worker, and attach global network online listeners.
 */
export const initOfflineSync = async () => {
  if (isInitialized && syncWorker) return;

  try {
    // 1. Initialize IndexedDB connection
    await openDB();

    // 2. Perform one-time migration from localStorage if exists
    await migrateFromLocalStorage();

    // 3. Purge failed items older than 7 days
    await purgeStaleItems();

    // 4. Initialize background sync worker if Web Workers are supported
    if (typeof Worker !== 'undefined') {
      if (syncWorker) {
        syncWorker.terminate();
      }

      syncWorker = new Worker('/attendanceSyncWorker.js');

      syncWorker.onmessage = (e) => {
        const data = e.data || {};
        broadcast(data);
      };

      syncWorker.onerror = (err) => {
        console.error('[OfflineSync] Worker error:', err);
        broadcast({ type: 'SYNC_ERROR', error: err.message || 'Worker error' });
      };
    }

    // 5. Global automatic sync trigger on network reconnection
    if (typeof window !== 'undefined' && !window.__attendease_online_listener_added) {
      window.__attendease_online_listener_added = true;
      window.addEventListener('online', async () => {
        console.info('[OfflineSync] 🌐 Network online detected. Triggering auto-sync...');
        try {
          await triggerOfflineSync();
        } catch (e) {
          console.warn('[OfflineSync] Auto-sync on online event failed:', e);
        }
      });
    }

    isInitialized = true;
  } catch (err) {
    console.error('[OfflineSync] Initialization failed:', err);
  }
};

/**
 * Register a callback to receive sync events from the background worker.
 * Returns an unsubscribe function.
 */
export const onSyncEvent = (callback) => {
  syncListeners.add(callback);
  return () => {
    syncListeners.delete(callback);
  };
};

/**
 * Save an attendance payload to the offline IndexedDB queue (capped at 100 items).
 * Automatically attempts background synchronization if the browser is online.
 */
export const saveToOfflineQueue = async (payload) => {
  await initOfflineSync();
  const queued = await idbAddToQueue(payload);
  broadcast({ type: 'ITEM_QUEUED', payload: queued });

  // If online, immediately trigger background synchronization
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    triggerOfflineSync().catch(() => {});
  }

  return queued;
};

/**
 * Get current count of pending offline attendance payloads in IndexedDB.
 */
export const getPendingSyncCount = async () => {
  try {
    return await idbGetPendingCount();
  } catch (e) {
    return 0;
  }
};

/**
 * Trigger synchronization of all pending offline records via the background Web Worker.
 * If Web Worker is unavailable, falls back to inline asynchronous fetch.
 */
export const triggerOfflineSync = async (token, apiUrl) => {
  await initOfflineSync();

  const currentCount = await getPendingSyncCount();
  if (currentCount === 0) {
    return { syncedCount: 0, failedCount: 0, remainingCount: 0 };
  }

  const effectiveApiUrl =
    apiUrl ||
    process.env.REACT_APP_API_URL ||
    'http://127.0.0.1:8011/api';
  const effectiveToken =
    token ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '') ||
    '';

  if (syncWorker) {
    // Dispatch job to background Web Worker
    syncWorker.postMessage({
      type: 'START_SYNC',
      token: effectiveToken,
      apiUrl: effectiveApiUrl,
    });
    return;
  }

  // Fallback for environments where Web Workers might be restricted
  return await fallbackInlineSync(effectiveToken, effectiveApiUrl);
};

/**
 * Fallback inline sync runner when Web Workers are unavailable
 */
async function fallbackInlineSync(token, apiUrl) {
  const items = await idbGetAllQueueItems();
  let syncedCount = 0;
  let failedCount = 0;

  for (const item of items) {
    if (item.attempts >= 5) continue;

    const p = item.payload;
    if (!p || typeof p !== 'object' || !p.subjectId || !p.section || !p.date || !p.attendanceData) {
      await idbRemoveItem(item.id);
      failedCount++;
      broadcast({ type: 'ITEM_FAILED', id: item.id, error: 'Malformed payload' });
      continue;
    }

    let normalizedAttendance = p.attendanceData;
    if (Array.isArray(p.attendanceData)) {
      normalizedAttendance = {};
      p.attendanceData.forEach((d) => {
        if (d && (d.studentId || d.id || d._id)) {
          const sId = String(d.studentId || d.id || d._id);
          normalizedAttendance[sId] = d.status || 'present';
        }
      });
    }

    try {
      await idbUpdateItemStatus(item.id, 'syncing');
      const isFaceDetection = p._faceDetectionOffline || p.verifiedStudents;
      const endpoint = isFaceDetection
        ? `${apiUrl.replace(/\/+$/, '')}/attendance/mark-face-detection`
        : `${apiUrl.replace(/\/+$/, '')}/attendance/mark`;

      const cleanPayload = { ...p };
      delete cleanPayload._faceDetectionOffline;
      const body = isFaceDetection
        ? { ...cleanPayload, isOfflineSync: true }
        : { ...cleanPayload, attendanceData: normalizedAttendance, isOfflineSync: true };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-offline-sync': 'true',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 200 || response.status === 201 || response.status === 409) {
        await idbRemoveItem(item.id);
        syncedCount++;
        broadcast({ type: 'ITEM_SYNCED', id: item.id });
      } else {
        await idbUpdateItemStatus(item.id, 'failed', `HTTP ${response.status}`);
        failedCount++;
        broadcast({ type: 'ITEM_FAILED', id: item.id, error: `HTTP ${response.status}` });
      }
    } catch (err) {
      await idbUpdateItemStatus(item.id, 'failed', err.message);
      failedCount++;
      broadcast({ type: 'ITEM_FAILED', id: item.id, error: err.message });
    }
  }

  const remainingCount = await idbGetPendingCount();
  const summary = { syncedCount, failedCount, remainingCount };
  broadcast({ type: 'SYNC_COMPLETE', ...summary });
  return summary;
}

/**
 * Terminate background worker and clean up connections.
 */
export const terminateWorker = () => {
  if (syncWorker) {
    syncWorker.terminate();
    syncWorker = null;
  }
  isInitialized = false;
};

export {
  idbClearAll as clearOfflineQueue,
};
