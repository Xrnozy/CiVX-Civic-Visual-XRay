import { useCallback, useEffect, useRef, useState } from 'react';
import { demoApi } from '../demoSession';

const CHUNK_MS = 10000;

type GpsPoint = { t: number; lat: number; lng: number };

export default function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const chunkIndexRef = useRef(0);
  const gpsTraceRef = useRef<GpsPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);

  const [recording, setRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [status, setStatus] = useState('Grant camera access to start passive scanning.');
  const [error, setError] = useState('');

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    stopWatch();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [stopWatch]);

  async function ensureCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    return stream;
  }

  async function uploadChunk(blob: Blob, index: number) {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const now = new Date().toISOString();
    const form = new FormData();
    form.append('chunk_index', String(index));
    form.append('start_time', now);
    form.append('end_time', now);
    form.append('gps_trace_json', JSON.stringify(gpsTraceRef.current.slice(-20)));
    form.append('video', blob, `chunk-${index}.webm`);
    await demoApi('/api/demo/passive/sessions/' + sid + '/chunks', { method: 'POST', body: form });
    setChunkCount((c) => c + 1);
    setStatus(`Uploaded chunk ${index + 1} — AI pipeline reviewing…`);
  }

  function startGpsWatch() {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        gpsTraceRef.current.push({
          t: Date.now(),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        if (gpsTraceRef.current.length > 200) gpsTraceRef.current.shift();
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
  }

  async function startPassive() {
    setError('');
    try {
      const stream = streamRef.current || (await ensureCamera());
      startGpsWatch();

      const form = new FormData();
      form.append('mode', 'passive');
      const session = await demoApi<{ id: string }>('/api/demo/passive/sessions', { method: 'POST', body: form });
      sessionIdRef.current = session.id;
      setSessionId(session.id);
      chunkIndexRef.current = 0;

      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (!ev.data.size) return;
        const idx = chunkIndexRef.current++;
        void uploadChunk(ev.data, idx).catch((e) => setError(String(e)));
      };

      recorder.start(CHUNK_MS);
      setRecording(true);
      setStatus('Passive mode active — recording 10s chunks with GPS.');

      const interval = window.setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start(CHUNK_MS);
        }
      }, CHUNK_MS);

      (recorder as MediaRecorder & { _interval?: number })._interval = interval;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start camera');
    }
  }

  function stopPassive() {
    const rec = mediaRecorderRef.current as (MediaRecorder & { _interval?: number }) | null;
    if (rec?._interval) clearInterval(rec._interval);
    rec?.stop();
    stopWatch();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
    setStatus('Session paused. Chunks continue processing in the background.');
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <div className="ui-card shrink-0">
        <p className="ui-card-title">Passive mode</p>
        <h2 className="mt-1 text-lg font-semibold">YOLO street scanning</h2>
        <p className="mt-2 text-sm text-ink-muted-48">
          Records short video chunks while you move. AI checks each chunk for visible civic issues.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-hairline bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      </div>

      <div className="shrink-0 space-y-2">
      <p className="text-sm text-ink-muted-48">{status}</p>
      {sessionId ? <p className="text-xs text-ink-muted-48">Session: {sessionId.slice(0, 8)}… · {chunkCount} chunks</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        {!recording ? (
          <button type="button" className="btn-primary flex-1 justify-center" onClick={() => void startPassive()}>
            Start passive scan
          </button>
        ) : (
          <button type="button" className="btn-secondary-pill flex-1 justify-center" onClick={stopPassive}>
            Stop
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
