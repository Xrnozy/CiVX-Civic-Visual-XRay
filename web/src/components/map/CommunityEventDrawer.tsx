import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  OrganizerEventDetailCard,
  type OrganizerCleanupEvent,
} from '../organizer/OrganizerEventDetailCard';

interface Props {
  event: OrganizerCleanupEvent | null;
  organizerName: string;
  goingCount: number;
  loading: boolean;
  onClose: () => void;
  overlay?: boolean;
  volunteerFooter?: ReactNode;
}

export function CommunityEventDrawer({
  event,
  organizerName,
  goingCount,
  loading,
  onClose,
  overlay = false,
  volunteerFooter,
}: Props) {
  if (loading && !event) {
    return (
      <aside
        className={
          overlay
            ? 'flex h-full w-full flex-col items-center justify-center rounded-r-[20px] border border-l-0 border-hairline bg-canvas shadow-2xl'
            : 'flex min-h-[320px] flex-col items-center justify-center rounded-[20px] border border-hairline bg-canvas'
        }
      >
        <p className="text-sm text-ink-muted-48">Loading event details…</p>
      </aside>
    );
  }

  if (!event) return null;

  return (
    <aside
      className={
        overlay
          ? 'flex h-full w-full flex-col overflow-hidden rounded-r-[20px] border border-l-0 border-hairline bg-canvas shadow-2xl'
          : 'flex max-h-[min(85vh,720px)] flex-col overflow-hidden rounded-[20px] border border-hairline bg-canvas'
      }
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 pb-4 pt-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Cleanup event</p>
          <h2 className="mt-1 text-[21px] font-semibold text-ink">{event.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-sm text-ink-muted-48 hover:bg-canvas-parchment hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <OrganizerEventDetailCard
          event={event}
          organizerName={organizerName}
          goingCount={goingCount}
          hideFullDetails
          embedded
          volunteerFooter={volunteerFooter}
        />
        <div className="border-t border-hairline px-4 py-4">
          <Link to={`/events/${event.id}`} className="btn-secondary-pill block w-full justify-center text-center">
            View event page
          </Link>
        </div>
      </div>
    </aside>
  );
}
