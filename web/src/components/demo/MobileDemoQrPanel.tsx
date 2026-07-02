import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { mobileDemoUrlForSession, resolveMobileDemoSessionUrl } from '../../mobile/mobileDemoUrl';

interface SessionResponse {
  token: string;
  url: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function parseApiError(text: string): string {
  try {
    const json = JSON.parse(text) as { detail?: string };
    if (json.detail) return json.detail;
  } catch {
    /* plain text */
  }
  return text || 'Could not create demo session';
}

function createClientSession(): SessionResponse {
  const token =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 22)
      : `demo${Date.now().toString(36)}`;
  return {
    token,
    url: mobileDemoUrlForSession(token),
  };
}

export function MobileDemoQrPanel({ open, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [sessionUrl, setSessionUrl] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offlineMode, setOfflineMode] = useState(false);

  async function applySession(data: SessionResponse, isOffline = false) {
    const url = resolveMobileDemoSessionUrl(data.token, data.url);
    setSessionUrl(url);
    setSessionToken(data.token);
    setOfflineMode(isOffline);
    const qr = await QRCode.toDataURL(url, { width: 220, margin: 2 });
    setQrDataUrl(qr);
  }

  async function createSession() {
    setLoading(true);
    setError('');
    setOfflineMode(false);
    try {
      const res = await fetch('/api/demo/sessions', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as SessionResponse;
        await applySession(data, false);
        return;
      }

      const body = await res.text();
      if (res.status === 404 || res.status === 502 || res.status === 503) {
        await applySession(createClientSession(), true);
        setError(
          'API session route unavailable. Showing a standalone demo link; restart the backend API to enable full demo sync.',
        );
        return;
      }
      throw new Error(parseApiError(body));
    } catch (e) {
      try {
        await applySession(createClientSession(), true);
        setError(
          e instanceof Error
            ? `${e.message}. Using a standalone demo link; restart the CiVX API if reports should sync to LGU.`
            : 'Using a standalone demo link.',
        );
      } catch {
        setError(e instanceof Error ? e.message : 'Could not create demo session');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void createSession();
  }, [open]);

  if (!open) return null;

  const registerHref = sessionToken
    ? `/register?session=${encodeURIComponent(sessionToken)}&next=${encodeURIComponent('/mobile/account')}`
    : '/register';
  const loginHref = sessionToken
    ? `/login?session=${encodeURIComponent(sessionToken)}&next=${encodeURIComponent('/mobile/account')}`
    : '/login';

  return (
    <div className="mobile-demo-qr-overlay" onClick={onClose} data-no-motion>
      <div
        className="mobile-demo-qr-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="mobile-demo-qr-title"
        data-no-motion
      >
        <div className="mobile-demo-qr-header">
          <div className="text-left">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">CiVX Mobile</p>
            <p id="mobile-demo-qr-title" className="text-sm font-semibold text-ink">
              Scan to open demo
            </p>
          </div>
          <button type="button" className="text-xs font-medium text-primary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mobile-demo-qr-body">
          <p className="mobile-demo-qr-lead">
            Scan with your phone camera to open the CiVX demo app on your mobile device.
          </p>

          <div className="mobile-demo-qr-frame">
            {loading ? (
              <div className="mobile-demo-qr-loading">Generating QR...</div>
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="QR code for mobile demo" className="mobile-demo-qr-image" width={220} height={220} />
            ) : null}
          </div>

          {offlineMode ? (
            <p className="text-xs text-amber-700">Standalone demo link (limited sync until API is restarted)</p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {sessionUrl ? <p className="mobile-demo-qr-url">{sessionUrl}</p> : null}

          <div className="mobile-demo-account-strip" data-no-motion>
            <div className="min-w-0 flex-1 text-left">
              <p className="mobile-demo-account-title">Optional account link</p>
              <p className="mobile-demo-account-copy">Save demo reports to a real profile when needed.</p>
            </div>
            <div className="mobile-demo-account-actions">
              <Link to={registerHref} className="btn-primary text-sm" onClick={onClose}>
                Create
              </Link>
              <Link to={loginHref} className="btn-secondary-pill text-sm" onClick={onClose}>
                Sign in
              </Link>
            </div>
          </div>

          <div className="mobile-demo-qr-actions">
            <button type="button" className="btn-primary text-sm" disabled={loading} onClick={() => void createSession()}>
              Regenerate QR
            </button>
            {sessionUrl ? (
              <button
                type="button"
                className="btn-secondary-pill text-sm"
                onClick={() => void navigator.clipboard.writeText(sessionUrl)}
              >
                Copy link
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
