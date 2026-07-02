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
