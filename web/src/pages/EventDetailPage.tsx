import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { Footer } from '../components/ui/Footer';
import { EventDetailHeader } from '../components/events/EventDetailHeader';
import { EventAttendanceQrPanel } from '../components/events/EventAttendanceQrPanel';
import { EventMapEmbed } from '../components/events/EventMapEmbed';
import { EventVolunteerSidebar } from '../components/events/EventVolunteerSidebar';
import { EventPhotoMasonry } from '../components/events/EventPhotoMasonry';
import { api } from '../lib/api';
import { isLguPortalRole } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import {
  canOrganizerEndEvent,
  getEventAttendancePhase,
  isEventEnded,
  isEventStarted,
  type AttendanceQrMode,
} from '../shared/eventLifecycle';
import type {
  EventParticipant,
  EventPhoto,
  EventPhotosResponse,
  PublicEventDetail,
} from '../types/eventDetail';
import { EVENT_CATEGORY_LABEL } from '../types/eventDetail';

function approvalStatusClass(status: string) {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-800';
}

function formatApprovalStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function formatDateTime(iso?: string) {
  if (!iso) return null;
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return null;
  return value.toLocaleString();
}

const DESCRIPTION_PREVIEW_LENGTH = 160;

function EventDescription({ description }: { description?: string }) {
  const [expanded, setExpanded] = useState(false);
  const text = description?.trim() || 'No description provided.';
  const isLong = text.length > DESCRIPTION_PREVIEW_LENGTH;
  const preview = isLong ? `${text.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd()}…` : text;

  return (
    <div className="border-t border-hairline pt-4">
      <h2 className="text-xs font-semibold text-ink">About this drive</h2>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted-80">
        {expanded || !isLong ? text : preview}
      </p>
      {isLong ? (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-primary hover:underline"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      ) : null}
    </div>
  );
}

type SidebarTab = 'details' | 'volunteers';

function EventSidebarTabs({
  active,
  onChange,
  volunteerCount,
}: {
  active: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  volunteerCount: number;
}) {
  const tabClass = (selected: boolean) =>
    `flex-1 border-b-2 px-1 pb-2.5 text-xs transition ${
      selected
        ? 'border-ink font-semibold text-ink'
        : 'border-transparent font-medium text-ink-muted-48 hover:text-ink-muted-80'
    }`;

  return (
    <div className="flex border-b border-hairline" role="tablist" aria-label="Event sidebar">
      <button
        type="button"
        role="tab"
        aria-selected={active === 'details'}
        className={tabClass(active === 'details')}
        onClick={() => onChange('details')}
      >
        Details
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'volunteers'}
        className={tabClass(active === 'volunteers')}
        onClick={() => onChange('volunteers')}
      >
        Volunteers{volunteerCount > 0 ? ` (${volunteerCount})` : ''}
      </button>
    </div>
  );
}

function parseApiError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    try {
      const json = JSON.parse(err.message) as { detail?: string };
      if (json.detail) return json.detail;
    } catch {
      /* plain text */
    }
    return err.message || fallback;
  }
  return fallback;
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, ready: authReady } = useAuth();
  const { profile } = useProfile();
  const [event, setEvent] = useState<PublicEventDetail | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState('');
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const [canUnhide, setCanUnhide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('details');
  const [showQr, setShowQr] = useState(false);
  const [qrMode, setQrMode] = useState<AttendanceQrMode>('check-in');
  const [ending, setEnding] = useState(false);

  const loginNext = eventId ? `/events/${eventId}` : '/events';

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(loginNext)}`, { replace: true });
    }
  }, [authReady, user, navigate, loginNext]);

  useEffect(() => {
    if (!eventId || !user) return;

    let cancelled = false;
    setLoading(true);
    setError('');

    api<PublicEventDetail>(`/api/cleanup-events/${eventId}`)
      .then((data) => {
        if (cancelled) return;
        // #region agent log
        fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'org-logo-only',location:'EventDetailPage.tsx:loadEvent',message:'event loaded',data:{eventId,organizerLogoUrl:data.organizer_logo_url??null,organizerName:data.organizer_name??null},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        setEvent(data);
        setGoingCount(data.going_count ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setEvent(null);
          setError('Event not found.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, user]);

  useEffect(() => {
    if (!eventId || !user || !event || event.approval_status !== 'approved') {
      setParticipants([]);
      setParticipantsError('');
      setParticipantsLoading(false);
      return;
    }

    let cancelled = false;
    setParticipantsLoading(true);
    setParticipantsError('');

    api<{ participants: EventParticipant[] }>(`/api/cleanup-events/${eventId}/participants`)
      .then((data) => {
        if (!cancelled) setParticipants(data.participants);
      })
      .catch(() => {
        if (!cancelled) {
          setParticipants([]);
          setParticipantsError('Unable to load volunteer names.');
        }
      })
      .finally(() => {
        if (!cancelled) setParticipantsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, user, event?.approval_status]);

  useEffect(() => {
    if (!eventId || !user) return;

    let cancelled = false;
    api<EventPhotosResponse>(`/api/cleanup-events/${eventId}/photos`)
      .then((data) => {
        if (!cancelled) {
          setPhotos(data.photos);
          setCanUpload(data.can_upload && !isLguPortalRole(profile?.role));
          setCanModerate(data.can_moderate);
          setCanUnhide(Boolean(data.can_unhide));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhotos([]);
          setCanUpload(false);
          setCanModerate(false);
          setCanUnhide(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, user, profile?.role]);

  if (!authReady || !user) {
    return (
      <div className="min-h-screen bg-canvas-parchment">
        <GlobalNav />
        <div className="page-content py-16 text-center text-sm text-ink-muted-48">Loading…</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas-parchment">
        <GlobalNav />
        <div className="page-content py-16 text-center text-sm text-ink-muted-48">Loading event…</div>
      </div>
    );
  }

  if (!event || error) {
    return (
      <div className="min-h-screen bg-canvas-parchment">
        <GlobalNav />
        <div className="page-content py-16 text-center">
          <p className="text-lg font-semibold text-ink">{error || 'Event not found.'}</p>
          <Link to="/events" className="mt-4 inline-block text-sm text-primary underline">
            Back to events
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const startLabel = formatDateTime(event.scheduled_start);
  const endLabel = formatDateTime(event.scheduled_end);
  const isOrganizer = profile?.id === event.organizer_user_id;
  const attendancePhase = getEventAttendancePhase(event);
  const eventEnded = isEventEnded(event.scheduled_end) || Boolean(event.checkout_qr_code_token);
  const organizerCanEnd = canOrganizerEndEvent(event);

  async function handleEndEvent() {
    if (
      !eventId ||
      !window.confirm(
        'End this event? Volunteers can no longer check in. A new checkout QR will be shown for volunteers to check out.',
      )
    ) {
      return;
    }
    setEnding(true);
    try {
      await api<{
        scheduled_end: string;
        checkout_qr_code_token: string;
      }>(`/api/cleanup-events/${eventId}/end`, {
        method: 'POST',
      });
      const refreshed = await api<PublicEventDetail>(`/api/cleanup-events/${eventId}`);
      setEvent(refreshed);
      setQrMode('check-out');
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'attendance-qr-v2',location:'EventDetailPage.tsx:handleEndEvent',message:'event ended show checkout button',data:{eventId,attendancePhase:getEventAttendancePhase(refreshed),hasCheckoutToken:Boolean(refreshed.checkout_qr_code_token)},timestamp:Date.now(),hypothesisId:'H-checkout'})}).catch(()=>{});
      // #endregion
    } catch (err) {
      window.alert(parseApiError(err, 'Unable to end event.'));
    } finally {
      setEnding(false);
    }
  }

  function openCheckInQr() {
    setQrMode('check-in');
    setShowQr(true);
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'attendance-qr',location:'EventDetailPage.tsx:openCheckInQr',message:'check-in qr opened',data:{eventId,attendancePhase,eventStarted:isEventStarted(event.scheduled_start)},timestamp:Date.now(),hypothesisId:'H-checkin'})}).catch(()=>{});
    // #endregion
  }

  async function openCheckOutQr() {
    let checkoutToken = event.checkout_qr_code_token;
    if (!checkoutToken && eventId) {
      try {
        const refreshed = await api<PublicEventDetail>(`/api/cleanup-events/${eventId}`);
        setEvent(refreshed);
        checkoutToken = refreshed.checkout_qr_code_token;
      } catch {
        /* keep current event */
      }
    }
    setQrMode('check-out');
    setShowQr(true);
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'attendance-qr-v2',location:'EventDetailPage.tsx:openCheckOutQr',message:'checkout qr opened',data:{eventId,attendancePhase,hasCheckoutToken:Boolean(checkoutToken)},timestamp:Date.now(),hypothesisId:'H-checkout'})}).catch(()=>{});
    // #endregion
  }

  const bannerActions = isOrganizer ? (
    <>
      {attendancePhase === 'before_start' ? (
        <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-ink-muted-80 shadow-sm">
          Check-in QR opens {startLabel || 'at event start'}
        </span>
      ) : null}
      {attendancePhase === 'checkin' ? (
        <button
          type="button"
          className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-white"
          onClick={openCheckInQr}
        >
          Show Check-in QR
        </button>
      ) : null}
      {attendancePhase === 'checkout' ? (
        <button
          type="button"
          className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-white"
          onClick={() => void openCheckOutQr()}
        >
          Show Checkout QR
        </button>
      ) : null}
      {organizerCanEnd ? (
        <button
          type="button"
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
          disabled={ending}
          onClick={() => void handleEndEvent()}
        >
          {ending ? 'Ending…' : 'End Event'}
        </button>
      ) : null}
    </>
  ) : null;

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <GlobalNav />
      <div className="page-content py-8">
        <Link to="/map" className="text-sm text-ink-muted-48 hover:text-ink">
          ← Back to map
        </Link>

        <div className="mt-4">
          <EventDetailHeader
            title={event.title}
            organizerName={event.organizer_name || 'Community organizer'}
            organizerLogoUrl={event.organizer_logo_url}
            bannerUrl={event.banner_url}
            bannerActions={bannerActions}
          />
        </div>

        <EventAttendanceQrPanel
          eventId={event.id}
          eventTitle={event.title}
          mode={qrMode}
          checkoutToken={event.checkout_qr_code_token}
          open={showQr}
          onClose={() => setShowQr(false)}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:items-start">
          <div className="min-w-0">
            <EventPhotoMasonry
              eventId={event.id}
              photos={photos}
              canUpload={canUpload}
              canModerate={canModerate}
              canUnhide={canUnhide}
              approvalStatus={event.approval_status}
              onPhotosChange={setPhotos}
            />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="store-utility-card bg-canvas p-4">
              <EventSidebarTabs
                active={sidebarTab}
                onChange={setSidebarTab}
                volunteerCount={participants.length}
              />

              {sidebarTab === 'details' ? (
                <div className="mt-4 space-y-4" role="tabpanel">
                  <dl className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
                      <dt className="text-ink-muted-48">Category</dt>
                      <dd className="font-medium text-ink">{EVENT_CATEGORY_LABEL}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
                      <dt className="text-ink-muted-48">Organized by</dt>
                      <dd className="text-right font-medium text-ink">
                        {event.organizer_name || 'Community organizer'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
                      <dt className="text-ink-muted-48">Location</dt>
                      <dd className="font-medium text-ink">{event.barangay || '—'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
                      <dt className="text-ink-muted-48">Status</dt>
                      <dd>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${approvalStatusClass(event.approval_status)}`}
                        >
                          {eventEnded ? 'Ended' : formatApprovalStatus(event.approval_status)}
                        </span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
                      <dt className="text-ink-muted-48">Start</dt>
                      <dd className="text-right font-medium text-ink">{startLabel || '—'}</dd>
                    </div>
                    {endLabel ? (
                      <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
                        <dt className="text-ink-muted-48">End</dt>
                        <dd className="text-right font-medium text-ink">{endLabel}</dd>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-ink-muted-48">Going</dt>
                      <dd className="font-medium text-ink">{goingCount}</dd>
                    </div>
                  </dl>

                  <EventMapEmbed
                    title={event.title}
                    latitude={event.latitude}
                    longitude={event.longitude}
                    compact
                  />

                  <EventDescription description={event.description} />
                </div>
              ) : (
                <div className="mt-4" role="tabpanel">
                  <EventVolunteerSidebar
                    participants={participants}
                    loading={participantsLoading}
                    error={participantsError}
                    approvalStatus={event.approval_status}
                    compact
                    tabPanel
                  />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
