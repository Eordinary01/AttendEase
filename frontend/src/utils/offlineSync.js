/**
 * OFFLINE ATTENDANCE SYNC UTILITY
 * Handles local caching (localStorage / IndexedDB) of attendance marks when offline,
 * and handles background auto-syncing when internet connectivity is restored.
 */

const STORAGE_KEY = 'attendease_offline_attendance_queue';

/**
 * Get all pending attendance payloads from local queue
 */
export const getOfflineQueue = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to read offline queue from localStorage:', e);
    return [];
  }
};

/**
 * Save pending attendance payload to offline queue
 */
export const saveToOfflineQueue = (payload) => {
  try {
    const queue = getOfflineQueue();
    const newItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    queue.push(newItem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    return newItem;
  } catch (e) {
    console.error('Failed to save payload to offline queue:', e);
    return null;
  }
};

/**
 * Remove an item from the queue after successful sync
 */
export const removeOfflineQueueItem = (id) => {
  try {
    const queue = getOfflineQueue();
    const updated = queue.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to remove item from offline queue:', e);
  }
};

/**
 * Clear all items in offline queue
 */
export const clearOfflineQueue = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear offline queue:', e);
  }
};

/**
 * Get count of pending offline attendance marks
 */
export const getPendingSyncCount = () => {
  return getOfflineQueue().length;
};

/**
 * Synchronize all pending offline attendance payloads to the backend API
 */
export const syncOfflineAttendance = async (apiClient) => {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { syncedCount: 0, failedCount: 0, remainingCount: 0 };

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    try {
      const res = await apiClient.post('/attendance/mark', item.payload);
      if (res.status === 200 || res.status === 201) {
        syncedCount++;
        removeOfflineQueueItem(item.id);
      }
    } catch (err) {
      // If attendance already exists on server, consider it synced to avoid duplicate errors
      if (err.response?.data?.message?.includes('already exists') || err.response?.status === 409) {
        syncedCount++;
        removeOfflineQueueItem(item.id);
      } else {
        failedCount++;
        // Increment attempts count
        try {
          const currentQueue = getOfflineQueue();
          const targetIndex = currentQueue.findIndex(q => q.id === item.id);
          if (targetIndex !== -1) {
            currentQueue[targetIndex].attempts = (currentQueue[targetIndex].attempts || 0) + 1;
            currentQueue[targetIndex].lastError = err.message || 'Sync failed';
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentQueue));
          }
        } catch (e) {}
      }
    }
  }

  const remainingCount = getPendingSyncCount();
  return { syncedCount, failedCount, remainingCount };
};
