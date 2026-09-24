/**
 * Demo Sandbox Storage & State Simulation Utility
 * Manages in-memory and sessionStorage mock state for demo sessions
 * so that mutating user actions update the UI without altering backend state.
 */

const DEMO_SESSION_KEY = 'demo_session';
const SANDBOX_PREFIX = 'demo_sandbox_';

export function isDemoActive() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    return Boolean(session?.isDemo && session?.expiresAt && Date.now() < session.expiresAt);
  } catch {
    return false;
  }
}

export function getDemoSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DEMO_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDemoSession(sessionData) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(sessionData));
}

export function clearDemoSession() {
  if (typeof window === 'undefined') return;
  // Clear demo session
  sessionStorage.removeItem(DEMO_SESSION_KEY);
  // Clear any simulated sandboxes
  Object.keys(sessionStorage).forEach((k) => {
    if (k.startsWith(SANDBOX_PREFIX)) {
      sessionStorage.removeItem(k);
    }
  });
}

export function getSimulatedItems(domain) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(`${SANDBOX_PREFIX}${domain}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSimulatedItem(domain, item) {
  if (typeof window === 'undefined') return item;
  try {
    const items = getSimulatedItems(domain);
    const newItem = {
      ...item,
      _id: item._id || `sim_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: item.createdAt || new Date().toISOString(),
      isSimulated: true,
    };
    items.unshift(newItem);
    sessionStorage.setItem(`${SANDBOX_PREFIX}${domain}`, JSON.stringify(items));
    return newItem;
  } catch {
    return item;
  }
}

/**
 * Merge simulated local items with backend data array
 */
export function mergeWithSimulated(domain, backendItems = [], idKey = '_id') {
  const simulated = getSimulatedItems(domain);
  if (!simulated.length) return backendItems;

  const existingIds = new Set(backendItems.map((item) => String(item[idKey] || item.id)));
  const uniqueSimulated = simulated.filter((item) => !existingIds.has(String(item[idKey] || item.id)));

  return [...uniqueSimulated, ...backendItems];
}
