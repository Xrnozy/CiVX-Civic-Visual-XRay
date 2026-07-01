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
          <div className="store-utility-card py-16 text-center">
            <p className="text-[21px] font-semibold text-ink">No upcoming events</p>
            <p className="mt-2 text-sm text-ink-muted-48">Approved cleanup drives will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {events.map((e) => (
              <Link
                key={e.id}
                to={`/events/${e.id}`}
                className="store-utility-card flex flex-col transition hover:border-primary/40"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Cleanup</p>
                <h3 className="mt-2 text-[21px] font-semibold text-ink">{e.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted-80">{e.description || 'Community cleanup drive'}</p>
                <p className="mt-4 text-sm font-medium text-ink">{new Date(e.scheduled_start).toLocaleString()}</p>
                <p className="mt-1 text-sm text-primary">{e.barangay || 'Citywide'}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
