import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { Footer } from '../components/ui/Footer';
import { ButtonPrimary } from '../components/ui/Buttons';
import { SubNavFrosted } from '../components/ui/SubNavFrosted';
import { FORM_FIELD_INPUT } from '../components/map/LocationPickerSection';
import { resolveAuthToken } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { ISSUE_CATEGORIES } from '../shared/constants';
import type { AnalyzerImageResponse, AnalyzerStatus, AnalyzerVideoResponse } from '../types/analyzer';
import { regionsFromDetection } from '../components/analyzer/DetectionPreviewOverlay';
import { AnalyzerPreviewHero } from '../components/analyzer/AnalyzerPreviewHero';
import { AnalyzerResultsPanel } from '../components/analyzer/AnalyzerResultsPanel';

const ANALYZE_IMAGE_TIMEOUT_MS = 10 * 60 * 1000;
const ANALYZE_VIDEO_TIMEOUT_MS = 45 * 60 * 1000;

function isVideoFile(file: File) {
  if (file.type.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|m4v)$/i.test(file.name);
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function parseApiError(text: string) {
  try {
    const json = JSON.parse(text) as { detail?: string };
    return json.detail || text;
  } catch {
    return text;
  }
}

export default function AnalyzerTestPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [issueType, setIssueType] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [warming, setWarming] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [imageResult, setImageResult] = useState<AnalyzerImageResponse | null>(null);
  const [videoResult, setVideoResult] = useState<AnalyzerVideoResponse | null>(null);
  const [status, setStatus] = useState<AnalyzerStatus | null>(null);
  const [playbackSecond, setPlaybackSecond] = useState(0);

  const isVideo = Boolean(file && isVideoFile(file));

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/analyzer/status');
      if (!res.ok) return;
      const data = (await res.json()) as AnalyzerStatus;
      setStatus(data);
      const loadError = data.last_load_error || data.error;
      if (data.loaded) {
        setWarming(false);
        setError('');
      } else if (!data.loading && warming) {
        setWarming(false);
        if (loadError) {
          setError(loadError);
          setProgress('');
        }
      }
      if (data.loading) {
        setProgress(
          'Downloading and loading model weights (~8 GB first time). Watch the backend terminal and Task Manager GPU — usage spikes after download.',
        );
      } else if (data.loaded) {
        setProgress(`Model loaded on ${data.device}${data.cuda_device ? ` (${data.cuda_device})` : ''}.`);
      } else if (loadError && !warming) {
        setProgress('');
      }
    } catch {
      /* ignore poll errors */
    }
  }, [warming]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!status?.loading && !warming) return;
    const id = window.setInterval(refreshStatus, 2000);
    return () => window.clearInterval(id);
  }, [status?.loading, warming, refreshStatus]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const modelLoaded = Boolean(status?.loaded);
  const modelLoading = Boolean(status?.loading || warming);
  const canAnalyze = useMemo(
    () => Boolean(file && !analyzing && !modelLoading && modelLoaded),
    [file, analyzing, modelLoading, modelLoaded],
  );

  function handleFileChange(selected: FileList | null) {
    const next = selected?.[0] ?? null;
    setFile(next);
    setImageResult(null);
    setVideoResult(null);
    setPlaybackSecond(0);
    setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  function handleSeekSecond(second: number) {
    setPlaybackSecond(second);
    const video = videoRef.current;
    if (video) {
      video.currentTime = second;
      void video.play().catch(() => undefined);
    }
  }

  async function loadGpuModel() {
    setWarming(true);
    setError('');
    setProgress('Starting model download/load on the backend…');
    try {
      const res = await fetch('/api/analyzer/warmup', { method: 'POST' });
      const data = (await res.json()) as { status?: string; message?: string };
      if (!res.ok) throw new Error(data.message || 'Warmup failed');
      setProgress(data.message || 'Loading model…');
      await refreshStatus();
    } catch (err) {
      setWarming(false);
      setError(err instanceof Error ? err.message : 'Failed to start model load');
    }
  }

  useEffect(() => {
    if (!analyzing) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/analyzer/queue/status');
        if (!res.ok) return;
        const data = (await res.json()) as {
          gpu?: { waiting_jobs?: number; current_job?: string | null; gpu_busy?: boolean };
        };
        const wait = data.gpu?.waiting_jobs ?? 0;
        const job = data.gpu?.current_job;
        if (wait > 0) {
          setProgress(`Waiting for GPU (${wait} job(s) ahead)…`);
        } else if (job) {
          setProgress(`GPU busy: ${job.replace(/_/g, ' ')}…`);
        }
      } catch {
        /* ignore */
      }
    };
    void poll();
    const id = window.setInterval(poll, 2000);
    return () => window.clearInterval(id);
  }, [analyzing]);

  async function analyze() {
    if (!file || !modelLoaded) return;
    if (!user) {
      navigate('/login?next=/analyzer');
      return;
    }
    setAnalyzing(true);
    setError('');
    setImageResult(null);
    setVideoResult(null);
    setPlaybackSecond(0);
    setProgress(
      isVideo
        ? 'Queued GPU scan — one video at a time on this machine (no parallel overload).'
        : 'Running inference on GPU — typically 30–120 seconds per image.',
    );

    const controller = new AbortController();
    const timeoutMs = isVideo ? ANALYZE_VIDEO_TIMEOUT_MS : ANALYZE_IMAGE_TIMEOUT_MS;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const form = new FormData();
      const token = await resolveAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      let endpoint = '/api/analyzer/image';
      if (isVideo) {
        endpoint = '/api/analyzer/video';
        form.append('video', file);
        form.append('gps_trace_json', '[]');
      } else {
        form.append('image', file);
        if (issueType) form.append('issue_type', issueType);
        if (latitude.trim()) form.append('latitude', latitude.trim());
        if (longitude.trim()) form.append('longitude', longitude.trim());
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      });

      const text = await res.text();
      if (!res.ok) throw new Error(parseApiError(text));

      if (isVideo) {
        setVideoResult(JSON.parse(text) as AnalyzerVideoResponse);
        setProgress('Video analysis complete.');
      } else {
        setImageResult(JSON.parse(text) as AnalyzerImageResponse);
        setProgress('Analysis complete.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError(
          isVideo
            ? 'Video analysis timed out. Try a shorter clip — the backend samples about 1 frame per second.'
            : 'Analysis timed out after 10 minutes. Check the backend terminal for errors.',
        );
      } else {
        setError(err instanceof Error ? parseApiError(err.message) : 'Analysis failed');
      }
      setProgress('');
    } finally {
      window.clearTimeout(timeoutId);
      setAnalyzing(false);
    }
  }

  const detection = imageResult?.detection;
  const videoDetections = videoResult?.detections ?? [];

  const imageOverlayRegions = useMemo(() => {
    if (!detection) return [];
    return regionsFromDetection(detection);
  }, [detection]);

  const showOverlay = Boolean(
    previewUrl &&
      ((imageResult &&
        imageOverlayRegions.length > 0 &&
        imageOverlayRegions.some((r) => r.box.x2 > r.box.x1)) ||
        (videoResult && videoDetections.some((d) => d.bounding_box.x2 > d.bounding_box.x1))),
  );

  const modelStatusLabel = status?.loaded
    ? 'Model loaded'
    : status?.loading || warming
      ? 'Loading model…'
      : 'Model not loaded';

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <GlobalNav />
      <SubNavFrosted
        title="Scene analyzer"
        lead="Passive video: screens 19 civic hazard types per keyframe · images use full grounding"
        action={
          <ButtonPrimary type="button" onClick={loadGpuModel} disabled={modelLoading || modelLoaded}>
            {modelLoaded ? 'GPU model ready' : modelLoading ? 'Loading GPU model…' : 'Load GPU model'}
          </ButtonPrimary>
        }
      >
        {status && (
          <>
            <span className="rounded-full bg-canvas-parchment px-3 py-1 text-xs text-ink-muted-48">
              {modelStatusLabel}
            </span>
            <span className="rounded-full bg-canvas-parchment px-3 py-1 text-xs text-ink-muted-48">
              {status.cuda_available ? `CUDA: ${status.cuda_device || status.device}` : `CPU (${status.device})`}
            </span>
            {status.generation_mode && (
              <span className="hidden rounded-full bg-canvas-parchment px-3 py-1 text-xs text-ink-muted-48 sm:inline">
                {status.generation_mode}
              </span>
            )}
          </>
        )}
      </SubNavFrosted>

      {status?.transformers_version && status.transformers_version < '4.57.0' && (
        <div className="page-content pt-4">
          <p className="text-xs text-red-600">
            transformers {status.transformers_version} is too old — restart the backend after:{' '}
            <code className="rounded bg-canvas-parchment px-1">pip install transformers==4.57.1</code>
          </p>
        </div>
      )}

      {(error || progress) && (
        <div className="page-content pt-4">
          {error && !analyzing && (
            <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {progress && (
            <p className={`text-sm text-ink-muted-80 ${error && !analyzing ? 'mt-2' : ''}`}>{progress}</p>
          )}
        </div>
      )}

      <AnalyzerPreviewHero
        previewUrl={previewUrl}
        isVideo={isVideo}
        showOverlay={showOverlay}
        imageOverlayRegions={imageOverlayRegions}
        imageResult={imageResult}
        detectionWidth={detection?.image_width}
        detectionHeight={detection?.image_height}
        videoDetections={videoDetections}
        frameTimestamps={videoResult?.frame_timestamps}
        videoRef={videoRef}
        onVideoTimeUpdate={(t) => setPlaybackSecond(Math.floor(t))}
      />

      <div className="page-content py-12">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="store-utility-card space-y-5 bg-canvas">
            <div>
              <h2 className="text-[21px] font-semibold text-ink">Upload &amp; analyze</h2>
              <p className="mt-1 text-sm text-ink-muted-48">
                Images: JPEG, PNG, or WebP up to 15 MB. Videos: MP4, MOV, or WebM up to 50 MB.
              </p>
            </div>

            {!modelLoaded && !modelLoading && (
              <p className="rounded-[12px] bg-canvas-parchment px-4 py-3 text-sm text-ink-muted-80">
                Use <strong>Load GPU model</strong> in the bar above before analyzing.
              </p>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Photo or video</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                onChange={(e) => handleFileChange(e.target.files)}
                className={`${FORM_FIELD_INPUT} file:mr-4 file:rounded-full file:border-0 file:bg-canvas-parchment file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink`}
              />
            </label>

            {isVideo && (
              <p className="rounded-[12px] bg-canvas-parchment px-4 py-3 text-sm text-ink-muted-80">
                Passive mode (queue): <strong>1 detect() pass</strong> screens all 19 hazard categories per keyframe (3 keyframes / 10s chunk). Cleanup events are not auto-flagged.
              </p>
            )}

            {!isVideo && (
              <div className="space-y-4 rounded-[12px] border border-hairline bg-canvas-parchment p-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Hint issue type (optional)</span>
                  <select
                    className={FORM_FIELD_INPUT}
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                  >
                    <option value="">Auto-detect civic issues</option>
                    {ISSUE_CATEGORIES.filter((c) => c !== 'cleanup_event').map((category) => (
                      <option key={category} value={category}>
                        {formatLabel(category)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Latitude (optional)</span>
                    <input
                      className={FORM_FIELD_INPUT}
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="14.579359"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Longitude (optional)</span>
                    <input
                      className={FORM_FIELD_INPUT}
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="121.040089"
                    />
                  </label>
                </div>
              </div>
            )}

            <ButtonPrimary type="button" onClick={analyze} disabled={!canAnalyze}>
              {analyzing
                ? isVideo
                  ? 'Analyzing video…'
                  : 'Analyzing scene…'
                : isVideo
                  ? 'Analyze video'
                  : 'Analyze image'}
            </ButtonPrimary>

            {!user && (
              <p className="text-sm text-ink-muted-48">
                <Link className="text-primary underline" to="/login?next=/analyzer">
                  Sign in
                </Link>{' '}
                to run analysis (loading the model works without an account).
              </p>
            )}
          </div>

          <AnalyzerResultsPanel
            analyzing={analyzing}
            imageResult={imageResult}
            videoResult={videoResult}
            playbackSecond={playbackSecond}
            onSeekSecond={handleSeekSecond}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
