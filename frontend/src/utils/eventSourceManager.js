/**
 * EventSourceManager (Fetch-based SSE Client)
 *
 * Why Fetch-based over native EventSource?
 * 1. Native EventSource cannot attach custom Authorization Bearer headers (needed for dual-mode auth).
 * 2. Native EventSource has limited cross-browser cookie/CORS configuration.
 * 3. Fetch-based ReadableStream gives granular control over exponential backoff, status callbacks,
 *    Last-Event-ID tracking, and client-side message deduplication.
 */

const API_URL = process.env.REACT_APP_API_URL || '';
const MAX_DEDUPE_CACHE_SIZE = 500;
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10000;

export class EventStreamClient {
  constructor() {
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'fallback_polling'
    this.listeners = new Map(); // eventName -> Set<Function>
    this.statusListeners = new Set(); // Set<Function>
    this.abortController = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.lastEventId = null;
    this.recentDedupeIds = new Set();
    this.dedupeOrder = [];
    this.subscribedEvents = [];
    this.isConnectedManually = false;

    // Listen for auth state changes to reconnect or disconnect
    if (typeof window !== 'undefined') {
      window.addEventListener('attendease:auth-changed', () => {
        if (localStorage.getItem('token')) {
          this.reconnect();
        } else {
          this.disconnect();
        }
      });

      // Immediate reconnect on online network event if disconnected or falling back
      window.addEventListener('online', () => {
        if (this.isConnectedManually && (this.status === 'fallback_polling' || this.status === 'reconnecting' || this.status === 'disconnected')) {
          this.reconnectAttempts = 0;
          this.reconnect();
        }
      });

      // Reconnect when tab is focused / visibility returns
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isConnectedManually) {
          if (this.status === 'fallback_polling' || this.status === 'disconnected') {
            this.reconnectAttempts = 0;
            this.reconnect();
          }
        }
      });
    }
  }

  setStatus(newStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.statusListeners.forEach((fn) => {
      try {
        fn(newStatus);
      } catch (err) {
        console.warn('[EventStream] Error in status listener:', err);
      }
    });
  }

  onStatusChange(listener) {
    this.statusListeners.add(listener);
    // Immediately notify current status
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Subscribe a callback to a specific SSE eventName or '*' for all events.
   * @returns {() => void} Unsubscribe function
   */
  on(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);

    return () => {
      const set = this.listeners.get(eventName);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(eventName);
        }
      }
    };
  }

  off(eventName, listener) {
    const set = this.listeners.get(eventName);
    if (set) {
      set.delete(listener);
    }
  }

  dispatch(eventName, data, envelope = {}) {
    // 1. Deduplication check
    const dedupeId = envelope.id || envelope.dedupeId;
    if (dedupeId) {
      if (this.recentDedupeIds.has(dedupeId)) {
        return; // Skip duplicate
      }
      this.recentDedupeIds.add(dedupeId);
      this.dedupeOrder.push(dedupeId);

      // Keep dedupe set bounded
      if (this.dedupeOrder.length > MAX_DEDUPE_CACHE_SIZE) {
        const oldest = this.dedupeOrder.shift();
        this.recentDedupeIds.delete(oldest);
      }
    }

    // 2. Dispatch to named listeners
    const namedSet = this.listeners.get(eventName);
    if (namedSet) {
      namedSet.forEach((fn) => {
        try {
          fn(data, envelope);
        } catch (err) {
          console.error(`[EventStream] Error in handler for '${eventName}':`, err);
        }
      });
    }

    // 3. Dispatch to wildcard listeners
    const wildcardSet = this.listeners.get('*');
    if (wildcardSet) {
      wildcardSet.forEach((fn) => {
        try {
          fn(eventName, data, envelope);
        } catch (err) {
          console.error('[EventStream] Error in wildcard handler:', err);
        }
      });
    }
  }

  /**
   * Connect to the SSE endpoint.
   *
   * @param {object} [options]
   * @param {string[]} [options.events] - Optional list of event names to filter on server
   */
  async connect({ events = [] } = {}) {
    this.isConnectedManually = true;
    this.subscribedEvents = events;

    // Check feature flag
    if (process.env.REACT_APP_ENABLE_SSE === 'false') {
      this.setStatus('fallback_polling');
      return;
    }

    // If already connected or connecting, do not create a duplicate connection
    if (this.status === 'connected' || this.status === 'connecting') {
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      this.setStatus('disconnected');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    // Build URL
    const cleanBase = API_URL.replace(/\/+$/, '');
    let streamUrl = cleanBase.endsWith('/api') ? `${cleanBase}/events/stream` : `${cleanBase}/api/events/stream`;
    if (events && events.length > 0) {
      streamUrl += `?events=${encodeURIComponent(events.join(','))}`;
    }

    this.abortController = new AbortController();

    try {
      const headers = {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (this.lastEventId) {
        headers['Last-Event-ID'] = this.lastEventId;
      }

      const response = await fetch(streamUrl, {
        method: 'GET',
        headers,
        cache: 'no-store',
        credentials: 'include',
        signal: this.abortController.signal,
      });

      if (response.status === 401 || response.status === 403) {
        console.warn('[EventStream] Authentication failed for stream connection');
        this.setStatus('failed');
        return;
      }

      if (!response.ok) {
        throw new Error(`SSE HTTP error ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported on response body');
      }

      this.setStatus('connected');
      this.reconnectAttempts = 0;

      // Stream reader loop
      await this.readStream(response.body.getReader());
    } catch (err) {
      if (this.abortController?.signal.aborted) {
        return;
      }

      console.warn('[EventStream] Connection error:', err.message);
      this.handleDisconnect();
    }
  }

  async readStream(reader) {
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Events in SSE protocol are delimited by double newline
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || ''; // Keep unfinished block in buffer

        for (const block of blocks) {
          this.parseBlock(block);
        }
      }
    } catch (err) {
      if (!this.abortController?.signal.aborted) {
        throw err;
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  }

  parseBlock(block) {
    if (!block || !block.trim()) return;

    let eventName = 'message';
    let dataBuffer = '';
    let id = null;

    const lines = block.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith(':')) {
        // Comment / keepalive heartbeat line — ignore
        continue;
      }

      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const dataContent = line.slice(5).trim();
        dataBuffer += (dataBuffer ? '\n' : '') + dataContent;
      } else if (line.startsWith('id:')) {
        id = line.slice(3).trim();
        this.lastEventId = id;
      }
    }

    if (eventName === 'close') {
      // Server instructed client to close/reconnect
      return;
    }

    let parsedData = dataBuffer;
    if (dataBuffer) {
      try {
        parsedData = JSON.parse(dataBuffer);
      } catch {
        parsedData = dataBuffer;
      }
    }

    this.dispatch(eventName, parsedData, { id });
  }

  handleDisconnect() {
    if (!this.isConnectedManually) {
      this.setStatus('disconnected');
      return;
    }

    this.reconnectAttempts += 1;

    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      console.warn('[EventStream] Max reconnection attempts reached. Switching to polling fallback.');
      this.setStatus('fallback_polling');

      // Schedule a background recovery probe to re-test stream connectivity after 30s
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (this.isConnectedManually && this.status === 'fallback_polling') {
          console.info('[EventStream] Probing stream recovery from fallback polling mode...');
          this.reconnectAttempts = Math.floor(MAX_RECONNECT_ATTEMPTS / 2);
          this.connect({ events: this.subscribedEvents });
        }
      }, 30000);
      return;
    }

    const backoff = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, this.reconnectAttempts - 1),
      MAX_BACKOFF_MS
    );
    const jitter = Math.random() * 800;
    const delay = backoff + jitter;

    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.connect({ events: this.subscribedEvents });
    }, delay);
  }

  reconnect() {
    this.disconnect();
    this.connect({ events: this.subscribedEvents });
  }

  disconnect() {
    this.isConnectedManually = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setStatus('disconnected');
  }
}

// Export singleton instance as default & named
export const eventSourceManager = new EventStreamClient();
export default eventSourceManager;
