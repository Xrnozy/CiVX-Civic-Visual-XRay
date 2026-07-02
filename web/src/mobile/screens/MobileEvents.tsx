import { useEffect, useState } from 'react';

interface Event {
  id: string;
  title: string;
  description?: string;
  scheduled_start: string;
  barangay?: string;
}

export default function MobileEvents() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetch('/api/cleanup-events?approved_only=true')
      .then((r) => r.json())
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="space-y-3 p-4">
      <div className="ui-card">
        <p className="ui-card-title">Community cleanup</p>
        <h2 className="mt-1 text-lg font-semibold">Approved volunteer drives</h2>
      </div>
      {events.length === 0 ? (
        <div className="ui-card text-sm text-ink-muted-48">No approved events yet.</div>
      ) : (
        events.map((e) => (
          <article key={e.id} className="ui-card">
            <h3 className="font-semibold text-ink">{e.title}</h3>
            <p className="mt-1 text-xs text-ink-muted-48">
              {e.barangay || 'Metro Manila'} · {new Date(e.scheduled_start).toLocaleString()}
            </p>
            {e.description ? <p className="mt-2 text-sm text-ink-muted-80">{e.description}</p> : null}
          </article>
        ))
      )}
    </div>
  );
}
