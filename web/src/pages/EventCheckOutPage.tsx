import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { Footer } from '../components/ui/Footer';
import { ButtonPrimary } from '../components/ui/Buttons';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { PublicEventDetail } from '../types/eventDetail';

type CheckOutState = 'idle' | 'locating' | 'submitting' | 'success' | 'error';

interface CheckOutResponse {
  status: string;
  calculated_hours: number;
  check_out_time: string;
}

function parseApiError(err: unknown): string {
  if (err instanceof Error) {
    const match = err.message.match(/\{"detail":"([^"]+)"\}/);
    if (match?.[1]) return match[1];
    return err.message;
  }
  return 'Check-out failed. Please try again.';
}

export default function EventCheckOutPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, ready: authReady } = useAuth();
  const [event, setEvent] = useState<PublicEventDetail | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [state, setState] = useState<CheckOutState>('idle');
  const [message, setMessage] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [hours, setHours] = useState<number | null>(null);

  const qrToken = searchParams.get('t')?.trim() || '';
  const loginNext = eventId
    ? `/check-out/${eventId}${qrToken ? `?t=${encodeURIComponent(qrToken)}` : ''}`
    : '/events';

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(loginNext)}`, { replace: true });
    }
  }, [authReady, user, navigate, loginNext]);

  useEffect(() => {
    if (!eventId || !user) return;

    let cancelled = false;
    setLoadingEvent(true);

    api<PublicEventDetail>(`/api/cleanup-events/${eventId}`)
      .then((data) => {
        if (!cancelled) setEvent(data);
      })
      .catch(() => {
        if (!cancelled) setEvent(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingEvent(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, user]);

  async function handleCheckOut() {
    if (!eventId || !event) return;
    if (!event.checkout_qr_code_token) {
      setState('error');
      setMessage('Checkout is not open for this event yet.');
      return;
    }
    if (!qrToken || qrToken !== event.checkout_qr_code_token) {
      setState('error');
      setMessage('Invalid or missing checkout QR code. Scan the organizer’s checkout QR.');
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
          const result = await api<CheckOutResponse>(
            `/api/attendance/events/${eventId}/web-check-out`,
            {
              method: 'POST',
              body: JSON.stringify({
                qr_code_id: qrToken,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            },
          );
          setCheckOutTime(result.check_out_time);
          setHours(result.calculated_hours);
          setState('success');
          setMessage('You are checked out. Thank you for volunteering!');
        } catch (err) {
          setState('error');
          setMessage(parseApiError(err));
        }
      },
      (geoError) => {
        setState('error');
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setMessage('Location permission is required to check out. Allow access and try again.');
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

  const checkoutOpen = Boolean(event.checkout_qr_code_token);
  const tokenValid = checkoutOpen && qrToken === event.checkout_qr_code_token;
  const busy = state === 'locating' || state === 'submitting';

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <GlobalNav />
      <div className="page-content py-10">
        <Link to={`/events/${event.id}`} className="text-sm text-ink-muted-48 hover:text-ink">
          ← Back to event
        </Link>

        <div className="store-utility-card mx-auto mt-6 max-w-lg bg-canvas p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Volunteer check-out</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">{event.title}</h1>
          <p className="mt-1 text-sm text-ink-muted-48">{event.barangay || 'Cleanup drive'}</p>

          {state === 'success' ? (
            <div className="mt-6 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-900">
              <p className="font-semibold">{message}</p>
              {checkOutTime ? (
                <p className="mt-2 text-emerald-800">
                  Checked out at {new Date(checkOutTime).toLocaleString()}
                </p>
              ) : null}
              {hours != null ? (
                <p className="mt-1 text-emerald-800">Volunteer time: {hours} hour{hours === 1 ? '' : 's'}</p>
              ) : null}
            </div>
          ) : (
            <>
              <p className="mt-6 text-sm text-ink-muted-80">
                We use your device location to confirm you are at the cleanup site before recording
                your checkout.
              </p>

              {!checkoutOpen ? (
                <p className="mt-4 text-sm text-amber-800">
                  Checkout is not open yet. The organizer will share a checkout QR when the event ends.
                </p>
              ) : !tokenValid ? (
                <p className="mt-4 text-sm text-amber-800">
                  Scan the organizer&apos;s checkout QR code to open this page with a valid token.
                </p>
              ) : (
                <ButtonPrimary
                  type="button"
                  className="mt-6 w-full justify-center"
                  disabled={busy}
                  onClick={() => void handleCheckOut()}
                >
                  {state === 'locating'
                    ? 'Getting location…'
                    : state === 'submitting'
                      ? 'Checking out…'
                      : 'Check out with GPS'}
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
