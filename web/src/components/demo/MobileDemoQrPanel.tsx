import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

const PRODUCTION_MOBILE_DEMO = 'https://civx.xrnozy.me/mobile';

interface Props {
  open: boolean;
  onClose: () => void;
}

function mobileDemoUrl(): string {
  const envUrl = import.meta.env.VITE_MOBILE_DEMO_URL as string | undefined;
  if (envUrl?.trim()) return envUrl.trim().replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.origin}/mobile`;
    }
  }
  return PRODUCTION_MOBILE_DEMO;
}

export function MobileDemoQrPanel({ open, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const url = mobileDemoUrl();
    setDemoUrl(url);
    setLoading(true);
    void QRCode.toDataURL(url, { width: 220, margin: 2 })
      .then(setQrDataUrl)
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  // #region agent log
  fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'fresh-session',location:'MobileDemoQrPanel.tsx:render',message:'QR panel render',data:{demoUrl,hasSessionParam:demoUrl.includes('session=')},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  return (
    <div className="mobile-demo-qr-overlay" onClick={onClose} data-no-motion>
      <div
        className="mobile-demo-qr-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="mobile-demo-qr-title"
        data-no-motion
      >
        <div className="mobile-demo-header border-b border-hairline">
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

        <div className="space-y-4 p-5">
          <p className="text-sm text-ink-muted-48">
            Scan with your phone camera to open a fresh CiVX mobile demo.
          </p>

          <div className="flex justify-center">
            {loading ? (
              <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl bg-canvas-parchment text-sm text-ink-muted-48">
                Generating QR…
              </div>
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="QR code for mobile demo" className="rounded-2xl border border-hairline" width={220} height={220} />
            ) : null}
          </div>

          {demoUrl ? (
            <p className="break-all text-xs text-ink-muted-48">{demoUrl}</p>
          ) : null}

          {demoUrl ? (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn-secondary-pill text-sm"
                onClick={() => void navigator.clipboard.writeText(demoUrl)}
              >
                Copy link
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
