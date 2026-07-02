import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatCard } from '../../components/ui/StatCard';
import {
  CleanupEventDetailPanel,
  cleanupStatusClass,
  type CleanupEvent,
} from '../../components/lgu/CleanupEventDetailPanel';
import { CleanupRejectionReason } from '../../components/lgu/CleanupRejectionReason';
import { FORM_FIELD_INPUT } from '../../components/map/LocationPickerSection';
import { api } from '../../lib/api';
import {
  ORGANIZER_DRIVE_FILTERS,
  ORGANIZER_EVENT_SORT_OPTIONS,
  filterOrganizerCleanupEvents,
  formatEventSchedulePhase,
  getOrganizerDriveListBadge,
  schedulePhaseListClass,
  sortOrganizerCleanupEvents,
  type OrganizerDriveFilter,
  type OrganizerEventSort,
} from '../../lib/eventSchedule';
import { formatLocationAddress } from '../../types/pickedAddress';

export default function LGUCleanupPage() {
  const [events, setEvents] = useState<CleanupEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrganizerDriveFilter>('pending');
  const [sortBy, setSortBy] = useState<OrganizerEventSort>('start');
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
      const filtered = filterOrganizerCleanupEvents(events, statusFilter);
      if (prev && filtered.some((e) => e.id === prev)) return prev;
      return filtered[0]?.id ?? null;
    });
  }, [statusFilter, events]);

  const filteredEvents = useMemo(
    () => filterOrganizerCleanupEvents(events, statusFilter),
    [events, statusFilter],
  );

  const sortedEvents = useMemo(
    () => sortOrganizerCleanupEvents(filteredEvents, sortBy),
    [filteredEvents, sortBy],
  );

  const stats = useMemo(
    () => ({
      pending: events.filter((e) => e.approval_status === 'pending').length,
      approved: events.filter((e) => e.approval_status === 'approved').length,
      total: events.length,
    }),
    [events],
  );

  const selected = sortedEvents.find((e) => e.id === selectedId) ?? events.find((e) => e.id === selectedId);

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

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Cleanup drives</h2>
            <p className="mt-1 text-sm text-ink-muted-48">
              {filteredEvents.length} of {events.length} drive{events.length === 1 ? '' : 's'}
            </p>
          </div>
          {events.length > 0 ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-muted-80">Sort by</span>
              <select
                className={`min-w-[180px] ${FORM_FIELD_INPUT}`}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as OrganizerEventSort)}
              >
                {ORGANIZER_EVENT_SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-hairline p-1">
            {ORGANIZER_DRIVE_FILTERS.map((filter) => (
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
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_460px]">
          <div className="space-y-3">
            {loading && sortedEvents.length === 0 && (
              <p className="text-sm text-ink-muted-48">Loading drives…</p>
            )}
            {!loading && sortedEvents.length === 0 && (
              <div className="store-utility-card bg-canvas py-12 text-center text-sm text-ink-muted-48">
                {statusFilter === 'pending'
                  ? 'No cleanup drives pending review.'
                  : 'No drives match this filter.'}
              </div>
            )}
            {sortedEvents.map((event) => {
              const listBadge = getOrganizerDriveListBadge(event);
              const schedulePhase =
                event.approval_status === 'approved'
                  ? formatEventSchedulePhase(event.scheduled_start, event.scheduled_end)
                  : null;
              return (
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
                      {formatLocationAddress(event) || event.barangay || '—'}
                      {event.scheduled_start ? ` · ${new Date(event.scheduled_start).toLocaleString()}` : ''}
                    </p>
                    {event.latitude != null && event.longitude != null && !formatLocationAddress(event) ? (
                      <p className="mt-1 text-xs text-ink-muted-48">
                        Pin: {Number(event.latitude).toFixed(5)}, {Number(event.longitude).toFixed(5)}
                      </p>
                    ) : null}
                    {event.approval_status === 'rejected' ? (
                      <CleanupRejectionReason reason={event.rejection_reason} compact />
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {listBadge ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${listBadge.className}`}>
                        {listBadge.label}
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${cleanupStatusClass(event.approval_status)}`}
                    >
                      {event.approval_status.replace('_', ' ')}
                    </span>
                    {schedulePhase && !listBadge ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${schedulePhaseListClass(schedulePhase.variant)}`}
                      >
                        {schedulePhase.label}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
            })}
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
