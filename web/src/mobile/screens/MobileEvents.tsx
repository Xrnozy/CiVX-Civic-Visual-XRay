import { useEffect, useState } from 'react';

interface Event {
  id: string;
  title: string;
  description?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  barangay?: string;
  approval_status?: string;
  max_volunteers?: number;
}

function formatDate(value?: string) {
  if (!value) return 'Schedule pending';
  return new Date(value).toLocaleString();
}

function statusLabel(value?: string) {
  return value?.replace(/_/g, ' ') || 'approved';
}

export default function MobileEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    fetch('/api/cleanup-events?approved_only=true')
      .then((r) => r.json())
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="mobile-list-screen">
      <section className="mobile-list-hero">
        <p className="mobile-native-eyebrow">Community cleanup</p>
        <h1>Approved volunteer drives</h1>
      </section>

      {events.length === 0 ? (
        <div className="mobile-native-empty">No approved events yet.</div>
      ) : (
        <div className="mobile-native-list">
          {events.map((event) => (
            <button key={event.id} type="button" className="mobile-native-list-card" onClick={() => setSelectedEvent(event)}>
              <strong>{event.title}</strong>
              <span>{event.barangay || 'Community area'} - {formatDate(event.scheduled_start)}</span>
              {event.description ? <p>{event.description}</p> : null}
            </button>
          ))}
        </div>
      )}

      {selectedEvent ? (
        <div className="mobile-native-sheet-backdrop" onClick={() => setSelectedEvent(null)}>
          <section className="mobile-native-detail-sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mobile-native-sheet-close" onClick={() => setSelectedEvent(null)}>Close</button>
            <p className="mobile-native-eyebrow">Approved cleanup</p>
            <h2>{selectedEvent.title}</h2>
            <p className="mobile-native-detail-copy">
              {selectedEvent.description || 'Community cleanup details will be updated by the organizer.'}
            </p>
            <div className="mobile-native-detail-grid">
              <div><span>Starts</span><strong>{formatDate(selectedEvent.scheduled_start)}</strong></div>
              <div><span>Ends</span><strong>{formatDate(selectedEvent.scheduled_end)}</strong></div>
              <div><span>Area</span><strong>{selectedEvent.barangay || 'Community area'}</strong></div>
              <div><span>Slots</span><strong>{selectedEvent.max_volunteers || 50} max volunteers</strong></div>
            </div>
            <div className="mobile-native-status-row">
              <span>{statusLabel(selectedEvent.approval_status)}</span>
            </div>
            <button type="button" className="mobile-native-full-button">Join event</button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
