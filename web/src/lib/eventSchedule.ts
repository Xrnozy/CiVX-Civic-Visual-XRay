export type EventSchedulePhase = {
  label: string;
  variant: 'upcoming' | 'live' | 'ended';
};

export function formatEventSchedulePhase(
  scheduledStart?: string,
  scheduledEnd?: string,
  now: Date = new Date(),
): EventSchedulePhase | null {
  if (!scheduledStart) return null;
  const start = new Date(scheduledStart);
  if (Number.isNaN(start.getTime())) return null;
  const end = scheduledEnd ? new Date(scheduledEnd) : null;

  if (end && !Number.isNaN(end.getTime()) && now > end) {
    return { label: 'Ended', variant: 'ended' };
  }
  if (now >= start && (!end || Number.isNaN(end.getTime()) || now <= end)) {
    return { label: 'Happening now', variant: 'live' };
  }

  const ms = start.getTime() - now.getTime();
  if (ms <= 0) return { label: 'Starting soon', variant: 'upcoming' };

  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor(ms / (60 * 1000));

  if (days >= 1) return { label: `Starting in ${days}d`, variant: 'upcoming' };
  if (hours >= 1) return { label: `Starting in ${hours}h`, variant: 'upcoming' };
  if (minutes >= 1) return { label: `Starting in ${minutes}m`, variant: 'upcoming' };
  return { label: 'Starting soon', variant: 'upcoming' };
}

export function schedulePhaseClass(variant: EventSchedulePhase['variant']) {
  if (variant === 'live') return 'bg-primary text-white';
  if (variant === 'ended') return 'bg-ink-muted-48/20 text-ink-muted-80';
  return 'bg-white/95 text-ink';
}

export function schedulePhaseListClass(variant: EventSchedulePhase['variant']) {
  if (variant === 'live') return 'bg-primary/10 text-primary';
  if (variant === 'ended') return 'bg-ink-muted-48/15 text-ink-muted-80';
  return 'bg-sky-100 text-sky-800';
}

/** Short month + day badge used on cleanup map/event preview cards (e.g. "JUL 2"). */
export function formatCleanupDateBadge(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return `${month} ${date.getDate()}`;
}

export type OrganizerEventSort = 'name' | 'created' | 'start' | 'end';

export const ORGANIZER_EVENT_SORT_OPTIONS: { id: OrganizerEventSort; label: string }[] = [
  { id: 'start', label: 'Closest to start' },
  { id: 'end', label: 'Closest to end' },
  { id: 'name', label: 'Event name' },
  { id: 'created', label: 'Date created' },
];

interface SortableOrganizerEvent {
  title: string;
  created_at?: string;
  scheduled_start: string;
  scheduled_end?: string;
}

export function sortOrganizerCleanupEvents<T extends SortableOrganizerEvent>(
  events: T[],
  sort: OrganizerEventSort,
): T[] {
  const copy = [...events];
  switch (sort) {
    case 'name':
      return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    case 'created':
      return copy.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
    case 'end':
      return copy.sort((a, b) => {
        const aEnd = a.scheduled_end ? new Date(a.scheduled_end).getTime() : Number.POSITIVE_INFINITY;
        const bEnd = b.scheduled_end ? new Date(b.scheduled_end).getTime() : Number.POSITIVE_INFINITY;
        if (Number.isNaN(aEnd)) return 1;
        if (Number.isNaN(bEnd)) return -1;
        return aEnd - bEnd;
      });
    case 'start':
    default:
      return copy.sort((a, b) => {
        const aStart = new Date(a.scheduled_start).getTime();
        const bStart = new Date(b.scheduled_start).getTime();
        if (Number.isNaN(aStart)) return 1;
        if (Number.isNaN(bStart)) return -1;
        return aStart - bStart;
      });
  }
}

export type OrganizerDriveFilter = 'all' | 'pending' | 'approved' | 'ended' | 'rejected';

export const ORGANIZER_DRIVE_FILTERS: { id: OrganizerDriveFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'ended', label: 'Ended' },
  { id: 'rejected', label: 'Rejected' },
];

interface FilterableOrganizerEvent extends SortableOrganizerEvent {
  approval_status: string;
}

export function classifyOrganizerDrive(event: FilterableOrganizerEvent): Exclude<OrganizerDriveFilter, 'all'> {
  if (event.approval_status === 'pending') return 'pending';
  if (event.approval_status === 'rejected') return 'rejected';
  const phase = formatEventSchedulePhase(event.scheduled_start, event.scheduled_end);
  if (event.approval_status === 'approved' && phase?.variant === 'ended') return 'ended';
  if (event.approval_status === 'approved') return 'approved';
  return 'pending';
}

export function filterOrganizerCleanupEvents<T extends FilterableOrganizerEvent>(
  events: T[],
  filter: OrganizerDriveFilter,
): T[] {
  if (filter === 'all') return events;
  return events.filter((event) => classifyOrganizerDrive(event) === filter);
}

export type OrganizerDriveListBadge = {
  label: string;
  className: string;
};

export function getOrganizerDriveListBadge(event: FilterableOrganizerEvent): OrganizerDriveListBadge | null {
  if (event.approval_status === 'pending') {
    return { label: '1–7 days review', className: 'bg-sky-100 text-sky-900' };
  }
  if (event.approval_status === 'rejected') {
    return null;
  }
  if (event.approval_status !== 'approved') {
    return null;
  }
  const phase = formatEventSchedulePhase(event.scheduled_start, event.scheduled_end);
  if (!phase) return null;
  return { label: phase.label, className: schedulePhaseListClass(phase.variant) };
}
