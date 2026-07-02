import { useCallback, useEffect, useRef, useState } from 'react';
import { demoApi } from '../demoSession';

/** Shorter chunks in the web demo so the first analysis starts sooner. */
const CHUNK_MS = 5000;

type Mode = 'passive' | 'drive';
type GpsPoint = { t: number; lat: number; lng: number };

function pickRecorderMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm';
}

function pipelineDebugLog(message: string, data: Record<string, unknown>, hypothesisId: string) {
  // #region agent log
  fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8b92e3' },
    body: JSON.stringify({
      sessionId: '8b92e3',
      runId: 'chunk-pipeline',
      location: 'MobileCamera.tsx',
      message,
      data,
      timestamp: Date.now(),
      hypothesisId,
    }),
  }).catch(() => undefined);
  // #endregion
}

export default function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const chunkIndexRef = useRef(0);
  const gpsTraceRef = useRef<GpsPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const requestDataTimerRef = useRef<number | null>(null);
  const uploadsPendingRef = useRef(0);

  const [mode, setMode] = useState<Mode>('passive');
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [capturedCount, setCapturedCount] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [status, setStatus] = useState('Camera, microphone, and location access are needed for recording.');
  const [error, setError] = useState('');

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const clearRequestDataTimer = useCallback(() => {
    if (requestDataTimerRef.current != null) {
      window.clearInterval(requestDataTimerRef.current);
      requestDataTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearRequestDataTimer();
    stopWatch();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [clearRequestDataTimer, stopWatch]);

  async function ensureCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: true,
    });
    streamRef.current = stream;
    setCameraReady(true);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    return stream;
  }

  function startGpsWatch() {
    if (!navigator.geolocation || watchIdRef.current != null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        gpsTraceRef.current.push({
          t: Date.now(),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        if (gpsTraceRef.current.length > 200) gpsTraceRef.current.shift();
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
  }

  async function uploadChunk(blob: Blob, index: number) {
    const sid = sessionIdRef.current;
    if (!sid) return;

    const now = new Date().toISOString();
    const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const form = new FormData();
    form.append('chunk_index', String(index));
    form.append('start_time', now);
    form.append('end_time', now);
    form.append('gps_trace_json', JSON.stringify(gpsTraceRef.current.slice(-20)));
    form.append('video', blob, `chunk-${index}.${extension}`);

    pipelineDebugLog('background upload started', {
      index,
      bytes: blob.size,
      recording: mediaRecorderRef.current?.state ?? 'none',
      pending: uploadsPendingRef.current,
    }, 'H1');

    await demoApi(`/api/demo/passive/sessions/${sid}/chunks`, { method: 'POST', body: form });

    setUploadedCount((count) => Math.max(count, index + 1));
    setStatus(
      mediaRecorderRef.current?.state === 'recording'
        ? `Recording - ${index + 1} chunks uploaded`
        : `Finishing uploads - ${index + 1} chunks sent`,
    );

    pipelineDebugLog('background upload finished', {
      index,
      recording: mediaRecorderRef.current?.state ?? 'none',
      pending: uploadsPendingRef.current - 1,
    }, 'H1');
  }

  function queueChunkUpload(blob: Blob, index: number) {
    uploadsPendingRef.current += 1;
    void uploadChunk(blob, index)
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        pipelineDebugLog('background upload failed', { index, error: message }, 'H1');
      })
      .finally(() => {
        uploadsPendingRef.current = Math.max(0, uploadsPendingRef.current - 1);
      });
  }

  function handleChunkBlob(blob: Blob) {
    if (!blob.size) return;
    const index = chunkIndexRef.current;
    chunkIndexRef.current += 1;
    setCapturedCount(index + 1);
    pipelineDebugLog('chunk captured while recording', {
      index,
      bytes: blob.size,
      recording: mediaRecorderRef.current?.state ?? 'none',
    }, 'H2');
    queueChunkUpload(blob, index);
  }

  async function startRecording() {
    setError('');
    try {
      const stream = streamRef.current || (await ensureCamera());
      startGpsWatch();

      const form = new FormData();
      form.append('mode', mode);
      const session = await demoApi<{ id: string }>('/api/demo/passive/sessions', { method: 'POST', body: form });
      sessionIdRef.current = session.id;
      setSessionId(session.id);
      setCapturedCount(0);
      setUploadedCount(0);
      chunkIndexRef.current = 0;

      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (!ev.data.size) return;
        handleChunkBlob(ev.data);
      };

      // Continuous record + periodic requestData works reliably on mobile browsers.
      recorder.start();
      requestDataTimerRef.current = window.setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
      }, CHUNK_MS);

      setRecording(true);
      setStatus(mode === 'passive' ? 'Passive recording active' : 'Drive recording active');
      pipelineDebugLog('recording started', { mimeType, chunkMs: CHUNK_MS }, 'H2');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start camera');
      setStatus('Camera, microphone, and location access are needed for recording.');
    }
  }

  function stopRecording() {
    clearRequestDataTimer();

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.requestData();
      window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 300);
    } else {
      recorder?.stop();
    }

    stopWatch();
    setRecording(false);
    setStatus(
      uploadsPendingRef.current > 0
        ? `Stopped. Uploading ${uploadsPendingRef.current} remaining chunk(s)…`
        : 'Session paused. Chunks continue processing in the background.',
    );

    pipelineDebugLog('recording stopped', {
      captured: chunkIndexRef.current,
      uploadsPending: uploadsPendingRef.current,
    }, 'H2');
  }

  function switchMode(next: Mode) {
    if (recording) stopRecording();
    setMode(next);
    setStatus('Camera, microphone, and location access are needed for recording.');
  }

  const pendingUploads = Math.max(0, capturedCount - uploadedCount);

  return (
    <div className="mobile-native-camera">
      <div className="mobile-native-camera-top">
        <div className="mobile-native-mode-toggle">
          <button type="button" className={mode === 'passive' ? 'active' : ''} onClick={() => switchMode('passive')}>
            Passive
          </button>
          <button type="button" className={mode === 'drive' ? 'active' : ''} onClick={() => switchMode('drive')}>
            Drive
          </button>
        </div>
      </div>

      <section className="mobile-native-camera-preview">
        <video ref={videoRef} playsInline muted className={cameraReady ? 'ready' : ''} />
        {!cameraReady ? (
          <div className="mobile-native-camera-permission">
            <p>{status}</p>
          </div>
        ) : null}
        {recording ? (
          <div className="mobile-native-recording-badge">
            <span />
            {mode === 'passive' ? 'Recording' : 'Drive'} - {capturedCount} captured
            {pendingUploads > 0 ? ` · ${uploadedCount} uploaded` : ''}
          </div>
        ) : null}
      </section>

      <div className="mobile-native-camera-bottom">
        <button
          type="button"
          className={`mobile-native-record-button ${recording ? 'recording' : ''}`}
          onClick={() => (recording ? stopRecording() : void startRecording())}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
        >
          <span />
        </button>
        {sessionId ? (
          <p>
            Session {sessionId.slice(0, 8)} - {capturedCount} captured / {uploadedCount} uploaded
          </p>
        ) : null}
        <p>{status}</p>
        {error ? <p className="mobile-native-camera-error">{error}</p> : null}
      </div>
    </div>
  );
}
