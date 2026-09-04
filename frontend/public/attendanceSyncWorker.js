/**
 * ATTENDANCE SYNC WEB WORKER
 * Runs in a background thread to process and synchronize offline attendance payloads
 * stored in IndexedDB to the backend API without blocking UI rendering or user interaction.
 */

const DB_NAME = 'AttendEaseOffline';
const STORE_NAME = 'attendanceQueue';
const MAX_ATTEMPTS = 5;

let isSyncing = false;
let cancelRequested = false;

/**
 * Open IndexedDB connection within worker context
 */
function openWorkerDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(new Error(`Worker DB Open Error: ${e.target.error?.message}`));
  });
}

/**
 * Fetch all items eligible for synchronization
 */
async function getEligibleItems(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      const now = Date.now();
      const eligible = all.filter((item) => {
        if (item.status === 'syncing') {
          // Reset stuck 'syncing' items older than 2 minutes
          const lastAttempt = item.lastAttemptAt ? new Date(item.lastAttemptAt).getTime() : 0;
          return now - lastAttempt > 120000;
        }
        if (item.attempts >= MAX_ATTEMPTS) return false;

        // Exponential backoff check: 2^attempts * 1000ms (max 30s)
        if (item.attempts > 0 && item.lastAttemptAt) {
          const backoffMs = Math.min(Math.pow(2, item.attempts) * 1000, 30000);
          const elapsed = now - new Date(item.lastAttemptAt).getTime();
          if (elapsed < backoffMs) return false;
        }
        return true;
      });
      resolve(eligible);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update item status in IndexedDB
 */
function updateWorkerItem(db, id, status, attemptsDelta = 0, error = null) {
  return new Promise((resolve) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) return resolve();

      item.status = status;
      item.lastAttemptAt = new Date().toISOString();
      if (attemptsDelta > 0) {
        item.attempts = (item.attempts || 0) + attemptsDelta;
      }
      if (error) {
        item.lastError = error;
      }

      store.put(item);
      resolve();
    };
    getReq.onerror = () => resolve();
  });
}

/**
 * Remove successfully synced item from IndexedDB
 */
function removeWorkerItem(db, id) {
  return new Promise((resolve) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
}

/**
 * Get remaining count in IndexedDB
 */
function getWorkerRemainingCount(db) {
  return new Promise((resolve) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => resolve(0);
  });
}

/**
 * Perform background synchronization loop
 */
async function processSync(token, apiUrl) {
  if (isSyncing) return;
  isSyncing = true;
  cancelRequested = false;

  let syncedCount = 0;
  let failedCount = 0;

  try {
    const db = await openWorkerDB();
    const items = await getEligibleItems(db);

    for (const item of items) {
      if (cancelRequested) break;

      await updateWorkerItem(db, item.id, 'syncing');

      // Validate required payload fields before attempting network call
      const p = item.payload;
      if (!p || typeof p !== 'object' || !p.subjectId || !p.section || !p.date || !p.attendanceData) {
        console.warn(`[SyncWorker] Item ${item.id} has malformed/invalid payload (missing required attendance fields). Discarding item.`, p);
        await removeWorkerItem(db, item.id);
        failedCount++;
        self.postMessage({ type: 'ITEM_FAILED', id: item.id, error: 'Malformed or incomplete payload' });
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
        const cleanApiUrl = (apiUrl || 'http://127.0.0.1:8011/api').replace(/\/+$/, '');
        const endpoint = `${cleanApiUrl}/attendance/mark`;

        console.info(`[SyncWorker] Syncing attendance item ${item.id} -> ${endpoint}...`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-offline-sync': 'true',
          },
          body: JSON.stringify({
            ...item.payload,
            attendanceData: normalizedAttendance,
            isOfflineSync: true,
          }),
        });

        let data = {};
        try {
          data = await response.json();
        } catch (_) {}

        if (response.status === 200 || response.status === 201) {
          // Success
          console.info(`[SyncWorker] ✅ Successfully synced item ${item.id}`);
          await removeWorkerItem(db, item.id);
          syncedCount++;
          self.postMessage({ type: 'ITEM_SYNCED', id: item.id });
        } else if (response.status === 409) {
          // Idempotent / already marked or conflict resolution
          console.info(`[SyncWorker] ℹ️ Item ${item.id} already exists or was marked on server (409). Handled idempotently.`);
          await removeWorkerItem(db, item.id);
          syncedCount++;
          self.postMessage({ type: 'ITEM_SYNCED', id: item.id });
        } else if (response.status === 400) {
          // Unrecoverable validation error — max out attempts to avoid infinite retries
          const errMsg = data?.message || 'Validation failed on server';
          console.warn(`[SyncWorker] ⚠️ Validation rejected for item ${item.id}: ${errMsg}`);
          await updateWorkerItem(db, item.id, 'failed', MAX_ATTEMPTS, errMsg);
          failedCount++;
          self.postMessage({ type: 'ITEM_FAILED', id: item.id, error: errMsg });
        } else if (response.status === 401 || response.status === 403) {
          // Authentication error
          const errMsg = data?.message || 'Authentication error (please re-login)';
          console.error(`[SyncWorker] ⛔ Auth error syncing item ${item.id}: ${errMsg}`);
          await updateWorkerItem(db, item.id, 'failed', 1, errMsg);
          failedCount++;
          self.postMessage({ type: 'ITEM_FAILED', id: item.id, error: errMsg });
        } else {
          // Retryable server or gateway error
          const errMsg = data?.message || `Server responded with ${response.status}`;
          console.warn(`[SyncWorker] ⚠️ Temporary error for item ${item.id} (HTTP ${response.status}): ${errMsg}`);
          await updateWorkerItem(db, item.id, 'failed', 1, errMsg);
          failedCount++;
          self.postMessage({ type: 'ITEM_FAILED', id: item.id, error: errMsg });
        }
      } catch (networkErr) {
        console.warn(`[SyncWorker] 📶 Network error syncing item ${item.id}:`, networkErr.message);
        await updateWorkerItem(db, item.id, 'failed', 1, networkErr.message || 'Network connection failed');
        failedCount++;
        self.postMessage({ type: 'ITEM_FAILED', id: item.id, error: networkErr.message || 'Network error' });
      }
    }

    const remainingCount = await getWorkerRemainingCount(db);
    self.postMessage({
      type: 'SYNC_COMPLETE',
      syncedCount,
      failedCount,
      remainingCount,
    });
  } catch (err) {
    self.postMessage({
      type: 'SYNC_ERROR',
      error: err.message || 'Worker sync failed',
    });
  } finally {
    isSyncing = false;
  }
}

/**
 * Worker message dispatcher
 */
self.onmessage = (event) => {
  const { type, token, apiUrl } = event.data || {};

  switch (type) {
    case 'START_SYNC':
      processSync(token, apiUrl);
      break;

    case 'CANCEL_SYNC':
      cancelRequested = true;
      break;

    default:
      break;
  }
};
