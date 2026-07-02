import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useDashboardSocket(onUpdate: (data: unknown) => void) {
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host =
      import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '') || window.location.host;
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

export function usePolling<T>(path: string, interval = 10000, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!enabled) return;

    const load = () => {
      if (document.hidden) return;
      api<T>(path).then(setData).catch(() => {});
    };

    load();
    const id = setInterval(load, interval);

    const onVisibility = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [path, interval, enabled]);
  return data;
}
