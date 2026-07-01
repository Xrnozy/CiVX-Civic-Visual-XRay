import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

const CHUNK_MS = 10000;

type GpsPoint = { t: number; lat: number; lng: number };

export default function PassiveModeScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const chunkIndexRef = useRef(0);
  const gpsTraceRef = useRef<GpsPoint[]>([]);
  const cameraRef = useRef<CameraView | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const recordingRef = useRef(false);
  const activeChunkRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = null;
      recordingRef.current = false;
      activeChunkRef.current = false;
      try {
        cameraRef.current?.stopRecording();
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  async function ensurePermissions() {
    if (!cameraPermission?.granted) {
      const response = await requestCameraPermission();
      if (!response.granted) throw new Error('Camera permission is required for passive mode.');
    }

    if (!microphonePermission?.granted) {
      const response = await requestMicrophonePermission();
      if (!response.granted) throw new Error('Microphone permission is required for video capture.');
    }

    if (!locationPermission?.granted) {
      const response = await requestLocationPermission();
      if (!response.granted) throw new Error('Location permission is required for passive mode.');
    }
  }

  async function startSession() {
    if (busy || recordingRef.current) return;

    setBusy(true);
    try {
      await ensurePermissions();

      const session = await api<{ id: string }>('/api/passive/sessions', {
        method: 'POST',
        body: JSON.stringify({ mode: 'passive' }),
      });

      sessionIdRef.current = session.id;
      setSessionId(session.id);
      chunkIndexRef.current = 0;
      gpsTraceRef.current = [];
      recordingRef.current = true;
      setRecording(true);

      timerRef.current = setInterval(() => {
        void captureChunk();
      }, CHUNK_MS);

      await captureChunk();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start passive mode.';
      Alert.alert('Passive mode unavailable', message);
      stopSession(false);
    } finally {
      setBusy(false);
    }
  }

  async function captureChunk() {
    if (!sessionIdRef.current || !cameraRef.current || activeChunkRef.current || !recordingRef.current) return;

    activeChunkRef.current = true;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const t = chunkIndexRef.current * (CHUNK_MS / 1000);
      gpsTraceRef.current.push({ t, lat: loc.coords.latitude, lng: loc.coords.longitude });

      const recorded = await cameraRef.current.recordAsync({ maxDuration: CHUNK_MS / 1000 });
      const uri = recorded?.uri;
      if (!uri) throw new Error('No video chunk was produced.');

      const form = new FormData();
      form.append('chunk_index', String(chunkIndexRef.current));
      form.append('start_time', new Date(Date.now() - CHUNK_MS).toISOString());
      form.append('end_time', new Date().toISOString());
      form.append('gps_trace_json', JSON.stringify(gpsTraceRef.current));
      form.append('video', { uri, name: `chunk_${chunkIndexRef.current}.mp4`, type: 'video/mp4' } as unknown as Blob);

      await api(`/api/passive/sessions/${sessionIdRef.current}/chunks`, { method: 'POST', body: form });
      chunkIndexRef.current += 1;
    } catch (error) {
      const queue = JSON.parse((await AsyncStorage.getItem('chunk_queue')) || '[]');
      queue.push({
        sessionId: sessionIdRef.current,
        index: chunkIndexRef.current,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await AsyncStorage.setItem('chunk_queue', JSON.stringify(queue));
    } finally {
      activeChunkRef.current = false;
    }
  }

  function stopSession(shouldNotify = true) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = null;
    recordingRef.current = false;
    setRecording(false);

    try {
      cameraRef.current?.stopRecording();
    } catch {
      // ignore stop errors
    }

    const currentSessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);

    if (shouldNotify && currentSessionId) {
      void api(`/api/passive/sessions/${currentSessionId}/end`, { method: 'POST' }).catch(() => undefined);
    }
  }

  if (!cameraPermission?.granted || !microphonePermission?.granted || !locationPermission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Passive mode needs camera, microphone, and location access.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => { void startSession(); }}>
          <Text style={styles.btnText}>Grant required permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView style={styles.flex} ref={cameraRef} />
      <View style={styles.controls}>
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.btnText}>Preparing passive session…</Text>
          </View>
        ) : !recording ? (
          <TouchableOpacity style={styles.btn} onPress={() => { void startSession(); }}>
            <Text style={styles.btnText}>Start Passive Mode</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnStop} onPress={() => stopSession()}>
            <Text style={styles.btnText}>Stop · Chunk {chunkIndexRef.current}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  controls: { padding: 16 },
  title: { fontSize: 16, marginBottom: 16, textAlign: 'center' },
  btn: { backgroundColor: '#0066cc', borderRadius: 999, padding: 16, alignItems: 'center' },
  btnStop: { backgroundColor: '#272729', borderRadius: 999, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17 },
  busyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
