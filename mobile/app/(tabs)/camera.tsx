import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

const CHUNK_MS = 10000;
const PRIMARY = '#0066cc';
const ACTION_BLUE = '#5AC8FA';

type Mode = 'passive' | 'drive';
type GpsPoint = { t: number; lat: number; lng: number };

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('passive');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);
  const [driverEvents, setDriverEvents] = useState(0);

  const chunkIndexRef = useRef(0);
  const gpsTraceRef = useRef<GpsPoint[]>([]);
  const cameraRef = useRef<CameraView | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const recordingRef = useRef(false);
  const activeChunkRef = useRef(false);
  const lastMagRef = useRef(1);
  const accelSubRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    return () => {
      cleanupPassiveRecording(false);
      cleanupDriverMonitoring(false);
    };
  }, []);

  async function ensurePermissions() {
    if (!cameraPermission?.granted) {
      const response = await requestCameraPermission();
      if (!response.granted) throw new Error('Camera permission is required.');
    }
    if (!microphonePermission?.granted) {
      const response = await requestMicrophonePermission();
      if (!response.granted) throw new Error('Microphone permission is required for video capture.');
    }
    if (!locationPermission?.granted) {
      const response = await requestLocationPermission();
      if (!response.granted) throw new Error('Location permission is required.');
    }
  }

  function cleanupPassiveRecording(shouldEndSession: boolean) {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recordingRef.current = false;
    setRecording(false);

    try {
      cameraRef.current?.stopRecording();
    } catch {
      // ignore cleanup errors
    }

    const currentSessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);

    if (shouldEndSession && currentSessionId) {
      void api(`/api/passive/sessions/${currentSessionId}/end`, { method: 'POST' }).catch(() => undefined);
    }
  }

  function cleanupDriverMonitoring(shouldEndSession: boolean) {
    accelSubRef.current?.remove();
    accelSubRef.current = null;

    const currentSessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);
    setRecording(false);

    if (shouldEndSession && currentSessionId) {
      void api(`/api/passive/sessions/${currentSessionId}/end`, { method: 'POST' }).catch(() => undefined);
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
      setChunkCount(chunkIndexRef.current);
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

  async function startPassiveRecording() {
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
      setChunkCount(0);
      gpsTraceRef.current = [];
      recordingRef.current = true;
      setRecording(true);

      timerRef.current = setInterval(() => {
        void captureChunk();
      }, CHUNK_MS);

      await captureChunk();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start passive recording.';
      Alert.alert('Recording unavailable', message);
      cleanupPassiveRecording(false);
    } finally {
      setBusy(false);
    }
  }

  function stopPassiveRecording() {
    cleanupPassiveRecording(true);
    chunkIndexRef.current = 0;
    setChunkCount(0);
  }

  async function startDriverMode() {
    if (busy || recording) return;

    setBusy(true);
    try {
      await ensurePermissions();

      const session = await api<{ id: string }>('/api/passive/sessions', {
        method: 'POST',
        body: JSON.stringify({ mode: 'driver' }),
      });

      sessionIdRef.current = session.id;
      setSessionId(session.id);
      setDriverEvents(0);
      setRecording(true);
      lastMagRef.current = 1;

      Accelerometer.setUpdateInterval(200);
      accelSubRef.current = Accelerometer.addListener(async ({ x, y, z }) => {
        const mag = Math.sqrt(x * x + y * y + z * z);
        const delta = Math.abs(mag - lastMagRef.current);
        lastMagRef.current = mag;

        if (delta > 2.5 && sessionIdRef.current) {
          const loc = await Location.getCurrentPositionAsync({});
          await api('/api/driver/sensor-events', {
            method: 'POST',
            body: JSON.stringify({
              route_session_id: sessionIdRef.current,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              magnitude: delta,
              event_type: 'bump',
              event_timestamp: new Date().toISOString(),
            }),
          });
          setDriverEvents((count) => count + 1);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start driver mode.';
      Alert.alert('Driver mode unavailable', message);
      cleanupDriverMonitoring(false);
    } finally {
      setBusy(false);
    }
  }

  function stopDriverMode() {
    cleanupDriverMonitoring(true);
    setDriverEvents(0);
  }

  function handleModeChange(next: Mode) {
    if (next === mode) return;
    if (recording || busy) {
      if (mode === 'passive') stopPassiveRecording();
      else stopDriverMode();
    }
    setMode(next);
  }

  async function handleActionPress() {
    if (busy) return;

    if (!cameraPermission?.granted || !microphonePermission?.granted || !locationPermission?.granted) {
      try {
        await ensurePermissions();
      } catch (error) {
        Alert.alert('Permissions required', error instanceof Error ? error.message : 'Grant all permissions to continue.');
      }
      return;
    }

    if (mode === 'passive') {
      if (recording) stopPassiveRecording();
      else await startPassiveRecording();
    } else if (recording) {
      stopDriverMode();
    } else {
      await startDriverMode();
    }
  }

  const permissionsReady =
    cameraPermission?.granted && microphonePermission?.granted && locationPermission?.granted;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeButton, mode === 'passive' && styles.modeButtonActive]}
            onPress={() => handleModeChange('passive')}
          >
            <Text style={[styles.modeText, mode === 'passive' && styles.modeTextActive]}>Passive</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === 'drive' && styles.modeButtonActive]}
            onPress={() => handleModeChange('drive')}
          >
            <Text style={[styles.modeText, mode === 'drive' && styles.modeTextActive]}>Drive</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.cameraSection}>
        {permissionsReady ? (
          <CameraView style={styles.camera} ref={cameraRef} mode="video" facing="back" />
        ) : (
          <View style={styles.permissionPlaceholder}>
            <Text style={styles.permissionText}>
              Camera, microphone, and location access are needed for recording.
            </Text>
          </View>
        )}

        {recording && mode === 'passive' && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingLabel}>Recording · {chunkCount} chunks</Text>
          </View>
        )}

        {recording && mode === 'drive' && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingLabel}>Monitoring · {driverEvents} events</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.actionButton, recording && styles.actionButtonActive]}
          onPress={() => { void handleActionPress(); }}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <View style={[styles.actionButtonInner, recording && styles.actionButtonInnerActive]} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#f5f5f7',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#e5e5ea',
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#ffffff',
  },
  modeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8e8e93',
  },
  modeTextActive: {
    color: '#1d1d1f',
    fontWeight: '600',
  },
  cameraSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  permissionPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
  },
  permissionText: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 24,
  },
  recordingBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
  recordingLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomBar: {
    height: 72,
    backgroundColor: '#e5e5ea',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ACTION_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -36,
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  actionButtonActive: {
    backgroundColor: PRIMARY,
  },
  actionButtonInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  actionButtonInnerActive: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
});
