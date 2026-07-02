import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { PublicEventDetail } from '../types/eventDetail';

function parseLoadError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    try {
      const json = JSON.parse(err.message) as { detail?: string };
      if (json.detail) return json.detail;
    } catch {
      /* plain text */
    }
    return err.message || fallback;
  }
  return fallback;
}

export function formatEventLoadError(err: unknown): string {
  const message = parseLoadError(err, 'Unable to load event.');
  if (message.includes('404') || message.toLowerCase().includes('not found')) {
    return 'Event not found.';
  }
  return 'Unable to load event. Please try again.';
}

/** Load a cleanup event once per eventId; ignores stale responses and retries once. */
export function useCleanupEventLoad(eventId: string | undefined, enabled = true) {
  const [event, setEvent] = useState<PublicEventDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId && enabled));
  const [error, setError] = useState('');
  const seqRef = useRef(0);

  useEffect(() => {
    if (!eventId || !enabled) {
      setEvent(null);
      setLoading(false);
      setError('');
      return;
    }

    const seq = ++seqRef.current;
    setLoading(true);
    setError('');
    setEvent(null);

    const load = async (attempt: number) => {
      try {
        const data = await api<PublicEventDetail>(`/api/cleanup-events/${eventId}`);
        if (seq !== seqRef.current) return;
        // #region agent log
        fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'event-detail-load',location:'useCleanupEventLoad.ts:load',message:'event loaded',data:{eventId,attempt,title:data.title??null},timestamp:Date.now(),hypothesisId:'H-race-fix'})}).catch(()=>{});
        // #endregion
        setEvent(data);
        setError('');
      } catch (err) {
        if (seq !== seqRef.current) return;
        if (attempt === 0) {
          await load(1);
          return;
        }
        setEvent(null);
        setError(formatEventLoadError(err));
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    };

    void load(0);
  }, [eventId, enabled]);

  return {
    event,
    setEvent,
    loading,
    error,
    goingCount: event?.going_count ?? 0,
  };
}
