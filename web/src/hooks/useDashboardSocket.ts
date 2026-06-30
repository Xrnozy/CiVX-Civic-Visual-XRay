import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useDashboardSocket(onUpdate: (data: unknown) => void) {
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '') || `${window.location.hostname}:8000`;
    const ws = new WebSocket(`${proto}://${host}/ws/dashboard`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'queue_update') onUpdate(msg.data);
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, [onUpdate]);
}

export function usePolling<T>(path: string, interval = 10000) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    const load = () => api<T>(path).then(setData).catch(() => {});
    load();
    const id = setInterval(load, interval);
    return () => clearInterval(id);
  }, [path, interval]);
  return data;
}
