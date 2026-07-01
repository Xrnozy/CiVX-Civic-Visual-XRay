import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ButtonPrimary } from '../../components/ui/Buttons';
import { DEFAULT_MAP_CENTER } from '../../shared/constants';

interface CleanupEvent {
  id: string;
  title: string;
  barangay?: string;
  scheduled_start: string;
  scheduled_end: string;
  approval_status: string;
  max_volunteers: number;
}

export default function OrganizerCleanupPage() {
  const [events, setEvents] = useState<CleanupEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    barangay: '',
    scheduled_start: '',
    scheduled_end: '',
    max_volunteers: 50,
    latitude: DEFAULT_MAP_CENTER.lat,
    longitude: DEFAULT_MAP_CENTER.lng,
  });

  const load = useCallback(() => {
    api<CleanupEvent[]>('/api/cleanup-events?mine=true').then(setEvents).catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api('/api/cleanup-events', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({
        title: '',
        description: '',
        barangay: '',
        scheduled_start: '',
        scheduled_end: '',
        max_volunteers: 50,
        latitude: DEFAULT_MAP_CENTER.lat,
        longitude: DEFAULT_MAP_CENTER.lng,
      });
      load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[28px] font-semibold text-ink">Cleanup drives</h2>
          <p className="mt-1 text-sm text-ink-muted-48">Drives require LGU approval before volunteers can join.</p>
        </div>
        <ButtonPrimary onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New cleanup drive'}</ButtonPrimary>
      </div>

      {showForm && (
        <form onSubmit={createEvent} className="store-utility-card mt-6 grid gap-4 md:grid-cols-2">
          <input className="auth-input md:col-span-2" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <textarea
            className="auth-input md:col-span-2"
            placeholder="Description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input className="auth-input" placeholder="Barangay" value={form.barangay} onChange={(e) => setForm({ ...form, barangay: e.target.value })} />
          <input className="auth-input" type="number" min={1} placeholder="Max volunteers" value={form.max_volunteers} onChange={(e) => setForm({ ...form, max_volunteers: Number(e.target.value) })} />
          <input className="auth-input" type="datetime-local" value={form.scheduled_start} onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })} required />
          <input className="auth-input" type="datetime-local" value={form.scheduled_end} onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })} required />
          <ButtonPrimary type="submit" className="md:col-span-2 justify-center" disabled={creating}>
            {creating ? 'Submitting…' : 'Submit for LGU approval'}
          </ButtonPrimary>
        </form>
      )}

      <div className="mt-10 space-y-4">
        {events.map((ev) => (
          <div key={ev.id} className="store-utility-card flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-ink">{ev.title}</p>
              <p className="text-sm text-ink-muted-48">
                {ev.barangay || '—'} · {new Date(ev.scheduled_start).toLocaleString()}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                ev.approval_status === 'approved'
                  ? 'bg-green-50 text-green-700'
                  : ev.approval_status === 'rejected'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              {ev.approval_status}
            </span>
          </div>
        ))}
        {events.length === 0 && <p className="text-sm text-ink-muted-48">No cleanup drives yet.</p>}
      </div>
    </div>
  );
}
