import { useEffect, useState } from 'react';
import { OrganizerEventDetailCard, type OrganizerCleanupEvent } from '../organizer/OrganizerEventDetailCard';
import { FORM_FIELD_INPUT } from '../map/LocationPickerSection';
import { ButtonPrimary, ButtonSecondaryPill } from '../ui/Buttons';
import { api } from '../../lib/api';
import type { EventParticipant, PublicEventDetail } from '../../types/eventDetail';

export interface CleanupEvent extends OrganizerCleanupEvent {
  max_volunteers?: number;
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

export function CleanupEventDetailPanel({ event, onAction }: Props) {
  const [busy, setBusy] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [detail, setDetail] = useState<PublicEventDetail | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState('');

  useEffect(() => {
    setShowRejectForm(false);
    setShowApproveConfirm(false);
    setRejectReason('');
    setRejectError('');
  }, [event.id]);

  useEffect(() => {
    let cancelled = false;
    api<PublicEventDetail>(`/api/cleanup-events/${event.id}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setGoingCount(data.going_count ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setGoingCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  useEffect(() => {
    if (event.approval_status !== 'approved') {
      setParticipants([]);
      setParticipantsError('');
      setParticipantsLoading(false);
      return;
    }
    let cancelled = false;
    setParticipantsLoading(true);
    setParticipantsError('');
    api<{ participants: EventParticipant[] }>(`/api/cleanup-events/${event.id}/participants`)
      .then((data) => {
        if (cancelled) return;
        setParticipants(data.participants ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setParticipants([]);
        setParticipantsError('Could not load volunteer list.');
      })
      .finally(() => {
        if (!cancelled) setParticipantsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id, event.approval_status]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      onAction();
    } finally {
      setBusy(false);
    }
  }

  async function submitApprove() {
    await run(() => api(`/api/cleanup-events/${event.id}/approve`, { method: 'POST' }));
  }

  async function submitReject() {
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError('Enter a reason so the organizer knows what to fix.');
      return;
    }
    setRejectError('');
    setBusy(true);
    try {
      const updated = await api<CleanupEvent>(`/api/cleanup-events/${event.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setDetail((prev) =>
        prev
          ? { ...prev, approval_status: 'rejected', rejection_reason: updated.rejection_reason ?? reason }
          : prev,
      );
      setShowRejectForm(false);
      setRejectReason('');
      await onAction();
    } finally {
      setBusy(false);
    }
  }

  const cardEvent: OrganizerCleanupEvent = {
    ...event,
    ...(detail
      ? {
          title: detail.title,
          description: detail.description,
          barangay: detail.barangay,
          scheduled_start: detail.scheduled_start,
          scheduled_end: detail.scheduled_end,
          approval_status: detail.approval_status,
          latitude: detail.latitude,
          longitude: detail.longitude,
          banner_url: detail.banner_url,
          rejection_reason: detail.rejection_reason ?? event.rejection_reason,
        }
      : {}),
  };

  const organizerName = detail?.organizer_name || 'Community organizer';

  return (
    <div className="space-y-4">
      <OrganizerEventDetailCard
        event={cardEvent}
        organizerName={organizerName}
        goingCount={goingCount}
        sticky={false}
        hideFullDetails={false}
        showVolunteerList={event.approval_status === 'approved'}
        participants={participants}
        participantsLoading={participantsLoading}
        participantsError={participantsError}
        volunteerFooter={
          event.approval_status === 'pending' ? (
            <div className="space-y-4 border-t border-hairline pt-4">
              {showApproveConfirm ? (
                <div className="space-y-3 rounded-[14px] border border-emerald-200 bg-emerald-50/60 p-4">
                  <div>
                    <p className="text-sm font-medium text-ink">Approve this cleanup drive?</p>
                    <p className="mt-1 text-xs text-ink-muted-48">
                      Volunteers will be able to register and the drive will appear on the public map.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <ButtonSecondaryPill
                      type="button"
                      disabled={busy}
                      onClick={() => setShowApproveConfirm(false)}
                    >
                      Cancel
                    </ButtonSecondaryPill>
                    <ButtonPrimary
                      type="button"
                      disabled={busy}
                      onClick={() => void submitApprove()}
                    >
                      {busy ? 'Saving…' : 'Confirm approve'}
                    </ButtonPrimary>
                  </div>
                </div>
              ) : null}
              {showRejectForm ? (
                <div className="space-y-3 rounded-[14px] border border-red-200 bg-red-50/60 p-4">
                  <div>
                    <label htmlFor={`reject-reason-${event.id}`} className="text-sm font-medium text-ink">
                      Rejection reason
                    </label>
                    <p className="mt-1 text-xs text-ink-muted-48">
                      Explain what needs to change before this drive can be approved.
                    </p>
                  </div>
                  <textarea
                    id={`reject-reason-${event.id}`}
                    className={`min-h-28 ${FORM_FIELD_INPUT}`}
                    value={rejectReason}
                    onChange={(e) => {
                      setRejectReason(e.target.value);
                      if (rejectError) setRejectError('');
                    }}
                    placeholder="e.g. Meeting point is outside the barangay boundary. Please pin the correct location and resubmit."
                    disabled={busy}
                  />
                  {rejectError ? <p className="text-sm text-red-600">{rejectError}</p> : null}
                  <div className="flex flex-wrap gap-3">
                    <ButtonSecondaryPill
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectReason('');
                        setRejectError('');
                      }}
                    >
                      Cancel
                    </ButtonSecondaryPill>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void submitReject()}
                      className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {busy ? 'Saving…' : 'Confirm reject'}
                    </button>
                  </div>
                </div>
              ) : !showApproveConfirm ? (
                <div className="flex flex-wrap gap-3">
                  <ButtonPrimary
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setShowApproveConfirm(true);
                      setShowRejectForm(false);
                    }}
                  >
                    Approve drive
                  </ButtonPrimary>
                  <ButtonSecondaryPill
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setShowRejectForm(true);
                      setShowApproveConfirm(false);
                    }}
                  >
                    Reject
                  </ButtonSecondaryPill>
                </div>
              ) : null}
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
