import { useEffect } from 'react';
import { ButtonSecondaryPill } from '../ui/Buttons';
import {
  OrganizerAttendeeRosterTable,
  type OrganizerEventAttendee,
} from './OrganizerAttendeeRosterTable';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  approvalStatus: string;
  attendees: OrganizerEventAttendee[];
  rosterLoading: boolean;
  rosterError: string;
  onClose: () => void;
}

export function OrganizerEventDetailsModal({
  open,
  title,
  description,
  approvalStatus,
  attendees,
  rosterLoading,
  rosterError,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-canvas shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="organizer-event-details-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 id="organizer-event-details-title" className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            className="text-sm text-ink-muted-48 hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
          <div className="shrink-0">
            <p className="text-sm font-medium text-ink">Description</p>
            <p className="mt-2 max-h-32 overflow-y-auto text-sm leading-relaxed text-ink-muted-80">
              {description?.trim() || 'No description provided.'}
            </p>
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <p className="shrink-0 text-sm font-medium text-ink">Attendee roster</p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <OrganizerAttendeeRosterTable
                attendees={attendees}
                loading={rosterLoading}
                error={rosterError}
                approvalStatus={approvalStatus}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-black/10 px-6 py-4">
          <ButtonSecondaryPill onClick={onClose}>Done</ButtonSecondaryPill>
        </div>
      </div>
    </div>
  );
}
