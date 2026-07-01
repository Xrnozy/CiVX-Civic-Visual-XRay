import { useState } from 'react';
import { CivicMap } from '../map/CivicMap';
import { ButtonPrimary, ButtonSecondaryPill } from '../ui/Buttons';
import { api } from '../../lib/api';

export interface CleanupEvent {
  id: string;
  title: string;
  description?: string;
  approval_status: string;
  barangay?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  max_volunteers?: number;
  latitude?: number;
  longitude?: number;
}

interface Props {
  event: CleanupEvent;
  onAction: () => void;
}

export function cleanupStatusClass(status: string) {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-800';
}

function hasCoords(event: CleanupEvent): boolean {
  const lat = Number(event.latitude);
  const lng = Number(event.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function CleanupEventDetailPanel({ event, onAction }: Props) {
  const [busy, setBusy] = useState(false);
  const located = hasCoords(event);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      onAction();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="store-utility-card flex flex-col bg-canvas">
      <div className="flex items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{event.title}</h2>
          <p className="mt-1 text-sm text-ink-muted-48">Review location and schedule before approval.</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize ${cleanupStatusClass(event.approval_status)}`}>
          {event.approval_status.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-ink">Event location</p>
        {located ? (
          <div className="map-shell mt-2 overflow-hidden rounded-[20px]">
            <CivicMap
              markers={[]}
              center={{ lat: Number(event.latitude), lng: Number(event.longitude) }}
              zoom={15}
              selectedLocation={{ latitude: Number(event.latitude), longitude: Number(event.longitude) }}
              heightClass="h-[320px]"
            />
          </div>
        ) : (
          <div className="mt-2 rounded-[20px] border border-dashed border-hairline bg-canvas-parchment px-4 py-10 text-center text-sm text-ink-muted-48">
            No location pinned — ask organizer to resubmit with a map pin.
          </div>
        )}
      </div>

      {located && (
        <p className="mt-2 text-xs text-ink-muted-48">
          {Number(event.latitude).toFixed(6)}, {Number(event.longitude).toFixed(6)}
        </p>
      )}

      <dl className="mt-5 grid gap-3 text-sm">
        <div className="flex justify-between gap-4 border-b border-hairline pb-2">
          <dt className="text-ink-muted-48">Barangay</dt>
          <dd className="text-right font-medium text-ink">{event.barangay || '—'}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-hairline pb-2">
          <dt className="text-ink-muted-48">Start</dt>
          <dd className="text-right font-medium text-ink">{formatDateTime(event.scheduled_start)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-hairline pb-2">
          <dt className="text-ink-muted-48">End</dt>
          <dd className="text-right font-medium text-ink">{formatDateTime(event.scheduled_end)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-hairline pb-2">
          <dt className="text-ink-muted-48">Max volunteers</dt>
          <dd className="text-right font-medium text-ink">{event.max_volunteers ?? '—'}</dd>
        </div>
      </dl>

      {event.description && (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">Description</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted-80">{event.description}</p>
        </div>
      )}

      {event.approval_status === 'pending' && (
        <div className="mt-6 flex flex-wrap gap-3 border-t border-hairline pt-4">
          <ButtonPrimary
            type="button"
            disabled={busy}
            onClick={() => run(() => api(`/api/cleanup-events/${event.id}/approve`, { method: 'POST' }))}
          >
            {busy ? 'Saving…' : 'Approve drive'}
          </ButtonPrimary>
          <ButtonSecondaryPill
            type="button"
            disabled={busy}
            onClick={() => run(() => api(`/api/cleanup-events/${event.id}/reject`, { method: 'POST' }))}
          >
            Reject
          </ButtonSecondaryPill>
        </div>
      )}
    </div>
  );
}
