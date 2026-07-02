import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatCard } from '../../components/ui/StatCard';
import {
  CleanupEventDetailPanel,
  cleanupStatusClass,
  type CleanupEvent,
} from '../../components/lgu/CleanupEventDetailPanel';
import { api } from '../../lib/api';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

export default function LGUCleanupPage() {
  const [events, setEvents] = useState<CleanupEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    return api<CleanupEvent[]>('/api/cleanup-events')
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelectedId((prev) => {
      const filtered = statusFilter === 'all' ? events : events.filter((e) => e.approval_status === statusFilter);
      if (prev && filtered.some((e) => e.id === prev)) return prev;
      return filtered[0]?.id ?? null;
    });
  }, [statusFilter, events]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return events;
    return events.filter((e) => e.approval_status === statusFilter);
  }, [events, statusFilter]);

  const stats = useMemo(
    () => ({
      pending: events.filter((e) => e.approval_status === 'pending').length,
      approved: events.filter((e) => e.approval_status === 'approved').length,
      total: events.length,
    }),
    [events],
  );

  const selected = filtered.find((e) => e.id === selectedId) ?? events.find((e) => e.id === selectedId);

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <div className="page-content">
        <p className="eyebrow mb-0">LGU Operations</p>
        <h1 className="mt-2 text-[34px] font-semibold tracking-tight text-ink md:text-[40px]">
          Cleanup approval
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted-80">
          Review organizer cleanup drives on the map, verify the meeting point, then approve or reject before
          volunteers can register.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Pending review" value={stats.pending} />
          <StatCard label="Approved" value={stats.approved} />
          <StatCard label="Total drives" value={stats.total} />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-hairline p-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  statusFilter === filter.id ? 'bg-primary text-white' : 'text-ink-muted-80'
                }`}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <span className="text-sm text-ink-muted-48">{filtered.length} drive{filtered.length === 1 ? '' : 's'}</span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
          <div className="space-y-3">
            {loading && filtered.length === 0 && (
              <p className="text-sm text-ink-muted-48">Loading drives…</p>
            )}
            {!loading && filtered.length === 0 && (
              <div className="store-utility-card bg-canvas py-12 text-center text-sm text-ink-muted-48">
                {statusFilter === 'pending'
                  ? 'No cleanup drives pending review.'
                  : 'No drives match this filter.'}
              </div>
            )}
            {filtered.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedId(event.id)}
                className={`store-utility-card w-full bg-canvas text-left transition ${
                  selectedId === event.id ? 'border-primary ring-2 ring-primary/20' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{event.title}</p>
                    <p className="mt-1 text-sm text-ink-muted-48">
                      {event.barangay || '—'}
                      {event.scheduled_start ? ` · ${new Date(event.scheduled_start).toLocaleString()}` : ''}
                    </p>
                    {event.latitude != null && event.longitude != null && (
                      <p className="mt-1 text-xs text-ink-muted-48">
                        {Number(event.latitude).toFixed(5)}, {Number(event.longitude).toFixed(5)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${cleanupStatusClass(event.approval_status)}`}
                  >
                    {event.approval_status.replace('_', ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            {selected ? (
              <CleanupEventDetailPanel event={selected} onAction={load} />
            ) : (
              <div className="store-utility-card bg-canvas py-12 text-center text-sm text-ink-muted-48">
                Select a cleanup drive to preview its location on the map and take action.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
