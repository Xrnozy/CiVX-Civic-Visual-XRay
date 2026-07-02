import { useCallback, useEffect, useRef, useState } from 'react';
import { demoApi } from '../demoSession';

const CHUNK_MS = 10000;

type Mode = 'passive' | 'drive';
type GpsPoint = { t: number; lat: number; lng: number };

export default function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const chunkIndexRef = useRef(0);
  const gpsTraceRef = useRef<GpsPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);

  const [mode, setMode] = useState<Mode>('passive');
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [status, setStatus] = useState('Camera, microphone, and location access are needed for recording.');
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
    const form = new FormData();
    form.append('chunk_index', String(index));
    form.append('start_time', now);
    form.append('end_time', now);
    form.append('gps_trace_json', JSON.stringify(gpsTraceRef.current.slice(-20)));
    form.append('video', blob, `chunk-${index}.webm`);
    await demoApi('/api/demo/passive/sessions/' + sid + '/chunks', { method: 'POST', body: form });
    setChunkCount((c) => c + 1);
    setStatus(`Recording - ${index + 1} chunks queued`);
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
      setChunkCount(0);
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
      setStatus(mode === 'passive' ? 'Passive recording active' : 'Drive recording active');

      const interval = window.setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start(CHUNK_MS);
        }
      }, CHUNK_MS);
      (recorder as MediaRecorder & { _interval?: number })._interval = interval;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start camera');
      setStatus('Camera, microphone, and location access are needed for recording.');
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current as (MediaRecorder & { _interval?: number }) | null;
    if (recorder?._interval) clearInterval(recorder._interval);
    recorder?.stop();
    stopWatch();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
    setRecording(false);
    setStatus('Session paused. Chunks continue processing in the background.');
  }

  function switchMode(next: Mode) {
    if (recording) stopRecording();
    setMode(next);
    setStatus('Camera, microphone, and location access are needed for recording.');
  }

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
            {mode === 'passive' ? 'Recording' : 'Drive'} - {chunkCount} chunks
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
        {sessionId ? <p>Session {sessionId.slice(0, 8)} - {chunkCount} chunks</p> : null}
        {error ? <p className="mobile-native-camera-error">{error}</p> : null}
      </div>
    </div>
  );
}
