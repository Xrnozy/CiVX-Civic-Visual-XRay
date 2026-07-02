import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { SubNavFrosted } from '../components/ui/SubNavFrosted';
import { Footer } from '../components/ui/Footer';
import { ButtonPrimary } from '../components/ui/Buttons';
import { api } from '../lib/api';

interface Event {
  id: string;
  title: string;
  description?: string;
  barangay?: string;
  scheduled_start: string;
  approval_status: string;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => {
    api<Event[]>('/api/cleanup-events?approved_only=true').then(setEvents).catch(() => setEvents([]));
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <GlobalNav />
      <SubNavFrosted
        title="Cleanup Events"
        lead="Join community-led drives approved by your LGU"
        action={<Link to="/login"><ButtonPrimary>Organize Event</ButtonPrimary></Link>}
      />
      <div className="page-content">
        {events.length === 0 ? (
          <div className="empty-state-card">
            <p className="empty-state-title">No upcoming events</p>
            <p className="empty-state-lead">Approved cleanup drives will appear here once your LGU publishes them.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <article key={e.id} className="store-utility-card flex flex-col">
                <p className="section-eyebrow text-[10px]">Cleanup</p>
                <h3 className="mt-3 text-[21px] font-semibold tracking-[-0.01em] text-ink">{e.title}</h3>
                <p className="mt-3 flex-1 text-[17px] leading-relaxed text-ink-muted-80">
                  {e.description || 'Community cleanup drive'}
                </p>
                <p className="event-card-meta">{new Date(e.scheduled_start).toLocaleString()}</p>
                <p className="mt-3 text-sm font-medium text-primary">{e.barangay || 'Citywide'}</p>
              </article>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
