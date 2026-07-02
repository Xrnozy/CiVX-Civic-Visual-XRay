import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { Footer } from '../components/ui/Footer';
import { ButtonPrimary } from '../components/ui/Buttons';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useCleanupEventLoad } from '../hooks/useCleanupEventLoad';
import type { PublicEventDetail } from '../types/eventDetail';
import { isEventEnded, isEventStarted, getEventAttendancePhase } from '../shared/eventLifecycle';

type CheckInState = 'idle' | 'locating' | 'submitting' | 'success' | 'error';

interface CheckInResponse {
  status: string;
  check_in_time: string;
}

function parseApiError(err: unknown): string {
  if (err instanceof Error) {
    const match = err.message.match(/\{"detail":"([^"]+)"\}/);
    if (match?.[1]) return match[1];
    return err.message;
  }
  return 'Check-in failed. Please try again.';
}

export default function EventCheckInPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, ready: authReady } = useAuth();
  const userId = user?.uid ?? null;
  const canLoad = Boolean(authReady && userId && eventId);
  const { event, loading: loadingEvent } = useCleanupEventLoad(eventId, canLoad);
  const [state, setState] = useState<CheckInState>('idle');
  const [message, setMessage] = useState('');
  const [checkInTime, setCheckInTime] = useState('');

  const loginNext = eventId ? `/check-in/${eventId}` : '/events';

  useEffect(() => {
    if (!authReady) return;
    if (!userId) {
      navigate(`/login?next=${encodeURIComponent(loginNext)}`, { replace: true });
    }
  }, [authReady, userId, navigate, loginNext]);

  async function handleCheckIn() {
    if (!eventId || !event) return;
    if (event.approval_status !== 'approved') {
      setState('error');
      setMessage('This event is not open for check-in.');
      return;
    }
    if (event.checkout_qr_code_token) {
      setState('error');
      setMessage('Check-in is closed. Use the checkout QR to check out.');
      return;
    }
    if (!isEventStarted(event.scheduled_start)) {
      setState('error');
      setMessage('Check-in opens when the event starts.');
      return;
    }
    if (isEventEnded(event.scheduled_end)) {
      setState('error');
      setMessage('This event has ended.');
      return;
    }
    if (!navigator.geolocation) {
      setState('error');
      setMessage('Your browser does not support location services.');
      return;
    }

    setState('locating');
    setMessage('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setState('submitting');
        try {
          const result = await api<CheckInResponse>(`/api/attendance/events/${eventId}/web-check-in`, {
            method: 'POST',
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });
          setCheckInTime(result.check_in_time);
          setState('success');
          setMessage('You are checked in. Thank you for volunteering!');
        } catch (err) {
          setState('error');
          setMessage(parseApiError(err));
        }
      },
      (geoError) => {
        setState('error');
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setMessage('Location permission is required to check in. Allow access and try again.');
        } else {
          setMessage('Unable to read your location. Move to the event site and try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  if (!authReady || !user) {
    return (
      <div className="min-h-screen bg-canvas-parchment">
        <GlobalNav />
        <div className="page-content py-16 text-center text-sm text-ink-muted-48">Loading…</div>
      </div>
    );
  }

  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-canvas-parchment">
        <GlobalNav />
        <div className="page-content py-16 text-center text-sm text-ink-muted-48">Loading event…</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-canvas-parchment">
        <GlobalNav />
        <div className="page-content py-16 text-center">
          <p className="text-lg font-semibold text-ink">Event not found.</p>
          <Link to="/events" className="mt-4 inline-block text-sm text-primary underline">
            Back to events
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const ended = isEventEnded(event.scheduled_end) || Boolean(event.checkout_qr_code_token);
  const notStarted = !isEventStarted(event.scheduled_start);
  const checkInPhase = getEventAttendancePhase(event);
  const busy = state === 'locating' || state === 'submitting';

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <GlobalNav />
      <div className="page-content py-10">
        <Link to={`/events/${event.id}`} className="text-sm text-ink-muted-48 hover:text-ink">
          ← Back to event
        </Link>

        <div className="store-utility-card mx-auto mt-6 max-w-lg bg-canvas p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Volunteer check-in</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">{event.title}</h1>
          <p className="mt-1 text-sm text-ink-muted-48">{event.barangay || 'Cleanup drive'}</p>

          {state === 'success' ? (
            <div className="mt-6 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-900">
              <p className="font-semibold">{message}</p>
              {checkInTime ? (
                <p className="mt-2 text-emerald-800">
                  Checked in at {new Date(checkInTime).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <p className="mt-6 text-sm text-ink-muted-80">
                We use your device location to confirm you are at the cleanup site before recording
                attendance.
              </p>

              {checkInPhase !== 'checkin' ? (
                <p className="mt-4 text-sm text-amber-800">
                  {event.checkout_qr_code_token
                    ? 'Check-in is closed. Scan the organizer’s checkout QR to check out.'
                    : notStarted
                      ? 'Check-in opens when the event starts.'
                      : ended
                        ? 'This event has ended and is no longer accepting check-ins.'
                        : 'This event is not yet approved for check-in.'}
                </p>
              ) : (
                <ButtonPrimary
                  type="button"
                  className="mt-6 w-full justify-center"
                  disabled={busy}
                  onClick={() => void handleCheckIn()}
                >
                  {state === 'locating'
                    ? 'Getting location…'
                    : state === 'submitting'
                      ? 'Checking in…'
                      : 'Check in with GPS'}
                </ButtonPrimary>
              )}

              {state === 'error' && message ? (
                <p className="mt-4 text-sm text-red-600" role="alert">
                  {message}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
