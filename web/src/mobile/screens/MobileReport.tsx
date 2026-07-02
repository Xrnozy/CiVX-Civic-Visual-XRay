import { FormEvent, useRef, useState } from 'react';
import { ISSUE_CATEGORIES } from '../../shared/constants';
import { demoApi } from '../demoSession';

interface AnalyzeResult {
  issue_type: string;
  confidence: number;
  ai_suggested_type?: string;
}

export default function MobileReport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [issueType, setIssueType] = useState('garbage_pile');
  const [description, setDescription] = useState('');
  const [locatePrompt, setLocatePrompt] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<AnalyzeResult | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function onFileChange(f: File | null) {
    setFile(f);
    setAiResult(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function analyzePhoto() {
    if (!file) {
      setError('Capture or choose a photo first.');
      return;
    }
    setAnalyzing(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      if (issueType) form.append('issue_type', issueType);
      if (locatePrompt.trim()) form.append('issue_type', locatePrompt.trim().replace(/\s+/g, '_').toLowerCase());
      const result = await demoApi<AnalyzeResult>('/api/demo/analyze/image', { method: 'POST', body: form });
      setAiResult(result);
      if (result.issue_type) setIssueType(result.issue_type);
      setMessage(`AI detected: ${result.issue_type.replace(/_/g, ' ')} (${Math.round((result.confidence || 0) * 100)}%)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Photo required');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
      });
      const form = new FormData();
      form.append('latitude', String(pos.coords.latitude));
      form.append('longitude', String(pos.coords.longitude));
      form.append('description', description.trim() || 'Mobile demo report');
      form.append('issue_type', issueType);
      form.append('photo', file);
      const result = await demoApi<{ incident_id?: string; merged?: boolean }>('/api/demo/reports', {
        method: 'POST',
        body: form,
      });
      setMessage(
        result.incident_id
          ? `Report submitted${result.merged ? ' (merged with nearby issue)' : ''}.`
          : 'Report submitted.',
      );
      onFileChange(null);
      setDescription('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4 p-4" onSubmit={(e) => void onSubmit(e)}>
      <div className="ui-card">
        <p className="ui-card-title">Citizen report</p>
        <h2 className="mt-1 text-lg font-semibold">Photo + GPS report</h2>
      </div>

      <div className="ui-card space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="w-full text-sm"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        {preview ? (
          <img src={preview} alt="Report preview" className="max-h-48 w-full rounded-xl object-cover" />
        ) : null}

        <label className="block text-sm">
          <span className="text-ink-muted-48">Issue type</span>
          <select className="filter-select mt-1 w-full" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
            {ISSUE_CATEGORIES.filter((c) => c !== 'cleanup_event').map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-ink-muted-48">Locate Anything (optional prompt)</span>
          <input
            className="mt-1 w-full rounded-xl border border-hairline px-3 py-2"
            placeholder="e.g. overflowing trash bin"
            value={locatePrompt}
            onChange={(e) => setLocatePrompt(e.target.value)}
          />
        </label>

        <button type="button" className="btn-secondary-pill w-full text-sm" disabled={analyzing || !file} onClick={() => void analyzePhoto()}>
          {analyzing ? 'Analyzing…' : 'Analyze with AI'}
        </button>
        {aiResult ? (
          <p className="text-xs text-primary">
            Suggested: {aiResult.ai_suggested_type || aiResult.issue_type} ·{' '}
            {Math.round((aiResult.confidence || 0) * 100)}% confidence
          </p>
        ) : null}

        <textarea
          className="w-full rounded-xl border border-hairline px-3 py-2 text-sm"
          rows={3}
          placeholder="Optional description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-primary">{message}</p> : null}

      <button type="submit" className="btn-primary w-full justify-center" disabled={submitting || !file}>
        {submitting ? 'Submitting…' : 'Submit report'}
      </button>
    </form>
  );
}
