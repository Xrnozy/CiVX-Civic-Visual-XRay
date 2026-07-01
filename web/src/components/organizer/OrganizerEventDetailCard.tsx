import { type ReactNode, useEffect, useState } from 'react';
import { ButtonSecondaryPill } from '../ui/Buttons';
import { OrganizerEventDetailsModal } from './OrganizerEventDetailsModal';
import type { OrganizerEventAttendee } from './OrganizerAttendeeRosterTable';

export interface OrganizerCleanupEvent {
  id: string;
  title: string;
  description?: string;
  barangay?: string;
  scheduled_start: string;
  scheduled_end: string;
  approval_status: string;
  latitude?: number;
  longitude?: number;
}

interface Props {
  event: OrganizerCleanupEvent;
  organizerName: string;
  goingCount: number;
  attendees?: OrganizerEventAttendee[];
  rosterLoading?: boolean;
  rosterError?: string;
  hideFullDetails?: boolean;
  embedded?: boolean;
  volunteerFooter?: ReactNode;
}

const EVENT_CATEGORY_LABEL = 'Cleanup drive';

const BANNER_PLACEHOLDER =
  'https://images.unsplash.com/photo-1532996122720-e3c354a0b15b?auto=format&fit=crop&w=920&q=80';

function approvalStatusClass(status: string) {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-800';
}

function formatApprovalStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function hasCoords(event: OrganizerCleanupEvent): boolean {
  const lat = Number(event.latitude);
  const lng = Number(event.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function mapsEmbedUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
}

export function OrganizerEventDetailCard({
  event,
  organizerName,
  goingCount,
  attendees = [],
  rosterLoading = false,
  rosterError = '',
  hideFullDetails = false,
  embedded = false,
  volunteerFooter,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const located = hasCoords(event);

  useEffect(() => {
    setDetailsOpen(false);
  }, [event.id]);

  return (
    <>
      <article
        className={
          embedded
            ? 'overflow-hidden bg-canvas'
            : 'store-utility-card overflow-hidden bg-canvas lg:sticky lg:top-24 lg:self-start'
        }
      >
        <div className="relative h-44 overflow-hidden bg-primary/10">
          <img
            src={BANNER_PLACEHOLDER}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">{EVENT_CATEGORY_LABEL}</p>
              <h3 className="mt-1 truncate text-lg font-semibold text-white">{event.title}</h3>
            </div>
            <div className="shrink-0 rounded-full bg-white/95 px-3 py-1.5 text-center shadow-sm">
              <p className="text-lg font-semibold leading-none text-ink">{goingCount}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted-48">Going</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <p className="text-sm font-medium text-ink">Location pin</p>
            {located ? (
              <div className="mt-2 overflow-hidden rounded-[16px] border border-hairline">
                <iframe
                  title={`Map pin for ${event.title}`}
                  src={mapsEmbedUrl(Number(event.latitude), Number(event.longitude))}
                  className="pointer-events-none h-[180px] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : (
              <div className="mt-2 rounded-[16px] border border-dashed border-hairline bg-canvas-parchment px-4 py-10 text-center text-sm text-ink-muted-48">
                No location pinned for this drive.
              </div>
            )}
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-hairline pb-2">
              <dt className="text-ink-muted-48">Category</dt>
              <dd className="text-right font-medium text-ink">{EVENT_CATEGORY_LABEL}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-hairline pb-2">
              <dt className="text-ink-muted-48">Organized by</dt>
              <dd className="text-right font-medium text-ink">{organizerName}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-hairline pb-2">
              <dt className="text-ink-muted-48">Location</dt>
              <dd className="text-right font-medium text-ink">{event.barangay || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-hairline pb-2">
              <dt className="text-ink-muted-48">Status</dt>
              <dd>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${approvalStatusClass(event.approval_status)}`}
                >
                  {formatApprovalStatus(event.approval_status)}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-hairline pb-2">
              <dt className="text-ink-muted-48">Start</dt>
              <dd className="text-right font-medium text-ink">{formatDateTime(event.scheduled_start)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted-48">End</dt>
              <dd className="text-right font-medium text-ink">{formatDateTime(event.scheduled_end)}</dd>
            </div>
          </dl>

          {volunteerFooter}

          {!hideFullDetails ? (
            <ButtonSecondaryPill
              type="button"
              className="w-full justify-center"
              aria-haspopup="dialog"
              onClick={() => setDetailsOpen(true)}
            >
              Full details
            </ButtonSecondaryPill>
          ) : null}
        </div>
      </article>

      {!hideFullDetails ? (
        <OrganizerEventDetailsModal
          open={detailsOpen}
          title={event.title}
          description={event.description}
          approvalStatus={event.approval_status}
          attendees={attendees}
          rosterLoading={rosterLoading}
          rosterError={rosterError}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}
    </>
  );
}
