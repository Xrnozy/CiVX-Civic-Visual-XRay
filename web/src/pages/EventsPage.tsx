import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CleanupEventPreviewCard } from '../components/events/CleanupEventPreviewCard';
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
  banner_url?: string | null;
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
<<<<<<< HEAD
          <div className="mx-auto grid w-full max-w-[1040px] grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
            {events.map((event) => (
              <CleanupEventPreviewCard
                key={event.id}
                to={`/events/${event.id}`}
                title={event.title}
                barangay={event.barangay}
                scheduledStart={event.scheduled_start}
                bannerUrl={event.banner_url}
              />
=======
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
>>>>>>> origin/Event-FullDetails-Page
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
