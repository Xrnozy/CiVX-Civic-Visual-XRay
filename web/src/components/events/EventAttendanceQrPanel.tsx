import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { checkInUrl } from '../../shared/eventLifecycle';

interface Props {
  eventId: string;
  eventTitle: string;
  open: boolean;
  onClose: () => void;
}

export function EventAttendanceQrPanel({ eventId, eventTitle, open, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const url = checkInUrl(eventId);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 280, margin: 2 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-qr-title"
      onClick={onClose}
    >
      <div
        className="store-utility-card max-w-md bg-canvas p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="attendance-qr-title" className="text-lg font-semibold text-ink">
          Attendance QR
        </h2>
        <p className="mt-1 text-sm text-ink-muted-48">
          Volunteers scan this code to check in at <strong className="text-ink">{eventTitle}</strong>.
        </p>

        <div className="mt-5 flex flex-col items-center gap-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Check-in QR code for ${eventTitle}`}
              className="rounded-xl border border-hairline"
            />
          ) : (
            <div className="flex h-[280px] w-[280px] items-center justify-center rounded-xl border border-dashed border-hairline text-sm text-ink-muted-48">
              Generating QR…
            </div>
          )}
          <p className="w-full break-all text-center text-xs text-ink-muted-48">{url}</p>
        </div>

        <button
          type="button"
          className="btn-secondary-pill mt-6 w-full justify-center"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
