import { useRef, useState } from 'react';
import { uploadProfileImage } from '../auth/ProfileImageUpload';

interface EventBannerUploadProps {
  value: string;
  previewUrl: string;
  onChange: (url: string, previewUrl: string) => void;
  onFileSelect?: (file: File | null) => void;
  label?: string;
  hint?: string;
}

export function EventBannerUpload({
  value,
  previewUrl,
  onChange,
  onFileSelect,
  label = 'Community banner',
  hint = 'Wide photo shown on the event page — your group, location, or past cleanup.',
}: EventBannerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const displaySrc = previewUrl || value;

  async function handleFile(file: File | null) {
    if (!file) return;
    onFileSelect?.(file);
    const localPreview = URL.createObjectURL(file);
    onChange('', localPreview);
    setBusy(true);
    setError('');
    try {
      const url = await uploadProfileImage(file);
      onChange(url, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      onChange('', localPreview);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-ink">{label}</label>
      {hint && <p className="text-xs text-ink-muted-48">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
      <div
        className="relative overflow-hidden rounded-[18px] border border-dashed border-hairline bg-canvas-parchment"
        style={{ aspectRatio: '21 / 9' }}
      >
        {displaySrc ? (
          <img src={displaySrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-ink-muted-48">
            <span className="text-2xl" aria-hidden>
              🖼
            </span>
            <span>Add a banner for your community drive</span>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
            Uploading…
          </div>
        )}
      </div>
      <button
        type="button"
        className="rounded-full border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink transition hover:border-primary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {displaySrc ? 'Change banner' : 'Upload banner'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
