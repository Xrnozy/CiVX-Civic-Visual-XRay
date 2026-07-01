import type { IncidentStatus } from '../../shared/constants';

const STATUS_STYLES: Record<IncidentStatus, string> = {
  detected: 'bg-surface-tile-2 text-white',
  pending_review: 'bg-amber-100 text-amber-900',
  verified: 'bg-blue-100 text-blue-900',
  assigned: 'bg-indigo-100 text-indigo-900',
  ongoing: 'bg-primary/10 text-primary',
  resolved: 'bg-emerald-100 text-emerald-900',
  archived: 'bg-canvas-parchment text-ink-muted-48',
};

export function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function IncidentStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as IncidentStatus] ?? 'bg-canvas-parchment text-ink-muted-80';
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${style}`}>
      {formatLabel(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority?: number }) {
  const p = priority ?? 0;
  const tone = p >= 70 ? 'bg-red-100 text-red-800' : p >= 40 ? 'bg-amber-100 text-amber-900' : 'bg-canvas-parchment text-ink-muted-80';
  return (
    <span className={`inline-flex min-w-[2.5rem] justify-center rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      {p}
    </span>
  );
}

export function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <span className="inline-flex rounded-full bg-canvas-parchment px-3 py-1 text-xs capitalize text-ink-muted-80">
      {source}
    </span>
  );
}
