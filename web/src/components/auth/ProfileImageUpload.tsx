import { useRef, useState } from 'react';
import { api } from '../../lib/api';

interface ProfileImageUploadProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
  /** When false, only picks a file locally (upload after sign-in). */
  authenticated?: boolean;
  onFileSelect?: (file: File | null, previewUrl: string) => void;
}

export async function uploadProfileImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await api<{ url: string }>('/api/media/upload', { method: 'POST', body: form });
  return res.url;
}

export function ProfileImageUpload({
  label,
  hint,
  value,
  onChange,
  required,
  authenticated = true,
  onFileSelect,
}: ProfileImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!authenticated) {
      const preview = URL.createObjectURL(file);
      onFileSelect?.(file, preview);
      onChange(preview);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const url = await uploadProfileImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-ink">{label}{required ? ' *' : ''}</label>
      {hint && <p className="text-xs text-ink-muted-48">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-16 w-16 rounded-[12px] border border-hairline object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-[12px] border border-dashed border-hairline bg-canvas-parchment text-xs text-ink-muted-48">
            No image
          </div>
        )}
        <button
          type="button"
          className="rounded-[999px] border border-hairline px-4 py-2 text-sm font-medium text-ink"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : value ? 'Change image' : 'Choose image'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
