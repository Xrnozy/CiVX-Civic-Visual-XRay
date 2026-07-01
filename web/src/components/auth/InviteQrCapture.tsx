import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseInviteToken } from '../../lib/inviteToken';

type CaptureMode = 'scan' | 'upload' | 'manual';

interface InviteQrCaptureProps {
  value: string;
  onChange: (token: string) => void;
  onTokenResolved?: (token: string) => void;
}

const MODES: { id: CaptureMode; label: string; hint: string }[] = [
  { id: 'scan', label: 'Scan QR', hint: 'Use your camera' },
  { id: 'upload', label: 'Upload image', hint: 'Photo of the QR' },
  { id: 'manual', label: 'Enter code', hint: 'Paste link or token' },
];

export function InviteQrCapture({ value, onChange, onTokenResolved }: InviteQrCaptureProps) {
  const [mode, setMode] = useState<CaptureMode>('scan');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = useId().replace(/:/g, '');
  const fileRegionId = `${regionId}-file`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyToken = useCallback(
    (raw: string) => {
      const token = parseInviteToken(raw);
      if (!token) {
        setError('No invite code found. Try again or enter it manually.');
        return;
      }
      setError('');
      setMessage('Invite code captured.');
      onChange(token);
      onTokenResolved?.(token);
    },
    [onChange, onTokenResolved],
  );

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch {
      /* ignore teardown errors */
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => {
    if (mode !== 'scan') {
      void stopScanner();
      return;
    }

    let cancelled = false;
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    async function start() {
      setBusy(true);
      setError('');
      setMessage('');
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            if (cancelled) return;
            applyToken(decoded);
            void stopScanner();
          },
          () => undefined,
        );
        if (!cancelled) setMessage('Point your camera at the LGU QR code.');
      } catch {
        if (!cancelled) {
          setError('Camera access denied or unavailable. Try uploading a QR image instead.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [mode, regionId, applyToken, stopScanner]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError('');
    setMessage('');
    const scanner = new Html5Qrcode(fileRegionId);
    try {
      const decoded = await scanner.scanFile(file, false);
      applyToken(decoded);
    } catch {
      setError('Could not read that image. Use a clear photo of the full QR code.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="invite-qr-capture">
      <div id={fileRegionId} className="hidden" aria-hidden />
      <div className="invite-qr-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`invite-qr-tab ${mode === m.id ? 'invite-qr-tab-active' : ''}`}
            onClick={() => {
              setMode(m.id);
              setError('');
              setMessage('');
            }}
          >
            <span className="font-medium">{m.label}</span>
            <span className="text-[11px] opacity-70">{m.hint}</span>
          </button>
        ))}
      </div>

      {mode === 'scan' && (
        <div className="invite-qr-scan-shell">
          <div id={regionId} className="invite-qr-viewport overflow-hidden rounded-[14px]" />
          {busy && !error && (
            <p className="mt-3 text-center text-sm text-ink-muted-48">Starting camera…</p>
          )}
        </div>
      )}

      {mode === 'upload' && (
        <div className="invite-qr-upload-shell">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="invite-qr-dropzone"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="invite-qr-dropzone-icon" aria-hidden>
              ↑
            </span>
            <span className="font-medium text-ink">{busy ? 'Reading QR…' : 'Choose QR image'}</span>
            <span className="text-sm text-ink-muted-48">PNG, JPG, or screenshot from your LGU</span>
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="space-y-2">
          <input
            className="auth-input"
            placeholder="Paste invite link or code"
            value={value}
            onChange={(e) => onChange(parseInviteToken(e.target.value))}
          />
          <p className="text-xs text-ink-muted-48">
            Example: <span className="font-mono">…/register?invite=abc123</span>
          </p>
        </div>
      )}

      {value && mode !== 'manual' && (
        <div className="invite-qr-token-preview">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">Code ready</span>
          <code className="mt-1 block truncate text-sm text-ink">{value}</code>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
