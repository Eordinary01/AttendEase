import { useEffect, useState, useRef } from 'react';
import eventSourceManager from '../utils/eventSourceManager';

/**
 * Custom React hook to subscribe to real-time domain events via SSE.
 *
 * @param {string|string[]} events - Event name or array of event names to listen for.
 * @param {(eventName: string, payload: any, envelope: any) => void} callback - Handler called when a matching event arrives.
 * @returns {{ status: string, isLive: boolean, reconnect: () => void }}
 */
export function useEventStream(events, callback) {
  const [status, setStatus] = useState(eventSourceManager.status);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    // Monitor connection status
    const unsubStatus = eventSourceManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Normalize event list
    const eventList = Array.isArray(events) ? events : [events];
    const unsubs = [];

    eventList.forEach((eventName) => {
      if (!eventName) return;
      const unsub = eventSourceManager.on(eventName, (payload, envelope) => {
        if (callbackRef.current) {
          callbackRef.current(eventName, payload, envelope);
        }
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubStatus();
      unsubs.forEach((unsub) => unsub());
    };
  }, [Array.isArray(events) ? events.join(',') : events]);

  return {
    status,
    isLive: status === 'connected',
    reconnect: () => eventSourceManager.reconnect(),
  };
}

export default useEventStream;
