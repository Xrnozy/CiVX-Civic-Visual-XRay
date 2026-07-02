import { useEffect, useMemo, useRef, useState } from 'react';
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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CameraPreview from '../../components/camera/CameraPreview';
import CameraSourcePicker from '../../components/camera/CameraSourcePicker';
import { useVideoInputs } from '../../hooks/useVideoInputs';
import { api } from '../../lib/api';
import { getFirebaseAuth } from '../../lib/firebase';
import type { CameraPreviewHandle } from '../../types/camera';
import type { VideoInput } from '../../types/camera';
import { colors, radii } from '../../styles/theme';
import ProfileAvatarButton from '../../components/ProfileAvatarButton';

const CHUNK_MS = 10000;
const RECORD_TIMEOUT_MS = CHUNK_MS + 8000;
const PRIMARY = colors.primary;
const ACTION_BLUE = '#5AC8FA';

type Mode = 'passive' | 'drive';
type GpsPoint = { t: number; lat: number; lng: number };

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

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
  const [selectedSourceId, setSelectedSourceId] = useState('phone-back');

  const { inputs, loading: inputsLoading, refresh: refreshInputs } = useVideoInputs(mode === 'drive');

  const chunkIndexRef = useRef(0);
  const gpsTraceRef = useRef<GpsPoint[]>([]);
  const passiveCameraRef = useRef<CameraView | null>(null);
  const driveCameraRef = useRef<CameraPreviewHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const recordingRef = useRef(false);
  const activeChunkRef = useRef(false);
  const lastMagRef = useRef(1);
  const accelSubRef = useRef<{ remove: () => void } | null>(null);
  const lastChunkIdRef = useRef<string | null>(null);
  const bumpCooldownRef = useRef(false);

  const selectedSource = useMemo(
    () => inputs.find((input) => input.id === selectedSourceId) ?? inputs[0],
    [inputs, selectedSourceId],
  );

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

  async function hasSignedInUser() {
    const storedToken = await AsyncStorage.getItem('civx_token');
    if (storedToken) return true;
    try {
      return Boolean(getFirebaseAuth().currentUser);
    } catch {
      return false;
    }
  }

  function redirectToSignIn() {
    router.push({ pathname: '/login', params: { next: '/(tabs)/camera' } });
  }

  function isAuthRequiredError(error: unknown) {
    return error instanceof Error && /sign in required|missing auth token|invalid token/i.test(error.message);
  }

  function cleanupPassiveRecording(shouldEndSession: boolean) {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recordingRef.current = false;
    setRecording(false);

    try {
      passiveCameraRef.current?.stopRecording();
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
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    accelSubRef.current?.remove();
    accelSubRef.current = null;
    recordingRef.current = false;
    setRecording(false);

    void driveCameraRef.current?.stopRecording().catch(() => undefined);

    const currentSessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);
    lastChunkIdRef.current = null;

    if (shouldEndSession && currentSessionId) {
      void api(`/api/passive/sessions/${currentSessionId}/end`, { method: 'POST' }).catch(() => undefined);
    }
  }

  async function uploadChunk(uri: string, chunkIndex: number) {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const t = chunkIndex * (CHUNK_MS / 1000);
    gpsTraceRef.current.push({ t, lat: loc.coords.latitude, lng: loc.coords.longitude });

    const extension = uri.endsWith('.webm') ? 'webm' : 'mp4';
    const mimeType = extension === 'webm' ? 'video/webm' : 'video/mp4';

    const form = new FormData();
    form.append('chunk_index', String(chunkIndex));
    form.append('start_time', new Date(Date.now() - CHUNK_MS).toISOString());
    form.append('end_time', new Date().toISOString());
    form.append('gps_trace_json', JSON.stringify(gpsTraceRef.current));
    form.append('video', { uri, name: `chunk_${chunkIndex}.${extension}`, type: mimeType } as unknown as Blob);

    const chunk = await api<{ id: string }>(`/api/passive/sessions/${sessionIdRef.current}/chunks`, {
      method: 'POST',
      body: form,
    });
    lastChunkIdRef.current = chunk.id;
    return chunk.id;
  }

  async function capturePassiveChunk() {
    if (!sessionIdRef.current || !passiveCameraRef.current || activeChunkRef.current || !recordingRef.current) return;

    activeChunkRef.current = true;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const t = chunkIndexRef.current * (CHUNK_MS / 1000);
      gpsTraceRef.current.push({ t, lat: loc.coords.latitude, lng: loc.coords.longitude });

      const recorded = await withTimeout(
        passiveCameraRef.current.recordAsync({ maxDuration: CHUNK_MS / 1000 }),
        RECORD_TIMEOUT_MS,
        'Phone camera recording timed out.',
      );
      const uri = recorded?.uri;
      if (!uri) throw new Error('No video chunk was produced.');

      await uploadChunk(uri, chunkIndexRef.current);
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
      try {
        passiveCameraRef.current?.stopRecording();
      } catch {
        // ignore recorder cleanup errors
      }
    } finally {
      activeChunkRef.current = false;
    }
  }

  async function captureDriveChunk() {
    if (!sessionIdRef.current || !driveCameraRef.current || activeChunkRef.current || !recordingRef.current) return;

    activeChunkRef.current = true;
    try {
      const recorded = await withTimeout(
        driveCameraRef.current.recordAsync({ maxDuration: CHUNK_MS / 1000 }),
        RECORD_TIMEOUT_MS,
        'Camera recording timed out.',
      );
      const uri = recorded?.uri;
      if (!uri) throw new Error('No video chunk was produced.');

      await uploadChunk(uri, chunkIndexRef.current);
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
      await driveCameraRef.current?.stopRecording().catch(() => undefined);
    } finally {
      activeChunkRef.current = false;
    }
  }

  async function postBumpEvent(delta: number) {
    if (!sessionIdRef.current || bumpCooldownRef.current) return;

    bumpCooldownRef.current = true;
    setTimeout(() => {
      bumpCooldownRef.current = false;
    }, 1500);

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
        video_chunk_id: lastChunkIdRef.current,
      }),
    });
    setDriverEvents((count) => count + 1);
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
        void capturePassiveChunk();
      }, CHUNK_MS);

      void capturePassiveChunk();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start passive recording.';
      if (isAuthRequiredError(error)) {
        redirectToSignIn();
        return;
      }
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
      await refreshInputs();

      const session = await api<{ id: string }>('/api/passive/sessions', {
        method: 'POST',
        body: JSON.stringify({ mode: 'driver', device_id: selectedSource?.id }),
      });

      sessionIdRef.current = session.id;
      setSessionId(session.id);
      chunkIndexRef.current = 0;
      setChunkCount(0);
      setDriverEvents(0);
      gpsTraceRef.current = [];
      recordingRef.current = true;
      setRecording(true);
      lastMagRef.current = 1;

      timerRef.current = setInterval(() => {
        void captureDriveChunk();
      }, CHUNK_MS);

      void captureDriveChunk();

      Accelerometer.setUpdateInterval(200);
      accelSubRef.current = Accelerometer.addListener(({ x, y, z }) => {
        const mag = Math.sqrt(x * x + y * y + z * z);
        const delta = Math.abs(mag - lastMagRef.current);
        lastMagRef.current = mag;

        if (delta > 2.5 && sessionIdRef.current) {
          void postBumpEvent(delta);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start driver mode.';
      if (isAuthRequiredError(error)) {
        redirectToSignIn();
        return;
      }
      Alert.alert('Driver mode unavailable', message);
      cleanupDriverMonitoring(false);
    } finally {
      setBusy(false);
    }
  }

  function stopDriverMode() {
    cleanupDriverMonitoring(true);
    setDriverEvents(0);
    chunkIndexRef.current = 0;
    setChunkCount(0);
  }

  function handleModeChange(next: Mode) {
    if (next === mode) return;
    if (recording || busy) {
      if (mode === 'passive') stopPassiveRecording();
      else stopDriverMode();
    }
    setMode(next);
  }

  function handleSelectSource(input: VideoInput) {
    if (recording || busy) return;
    setSelectedSourceId(input.id);
  }

  async function handleActionPress() {
    if (busy) return;

    if (!(await hasSignedInUser())) {
      redirectToSignIn();
      return;
    }

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
      return;
    }

    if (recording) stopDriverMode();
    else await startDriverMode();
  }

  const permissionsReady =
    cameraPermission?.granted && microphonePermission?.granted && locationPermission?.granted;

  const drivePreviewSource = selectedSource ?? {
    id: 'phone-back',
    label: 'Phone rear camera',
    kind: 'phone-back' as const,
  };

  return (
    <View style={styles.container}>
      <ProfileAvatarButton />
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

        {mode === 'drive' ? (
          <CameraSourcePicker
            inputs={inputs}
            selectedId={selectedSourceId}
            loading={inputsLoading}
            onSelect={handleSelectSource}
            onRefresh={() => { void refreshInputs(); }}
          />
        ) : null}
      </View>

      <View style={styles.cameraSection}>
        {permissionsReady ? (
          mode === 'passive' ? (
            <CameraView style={styles.camera} ref={passiveCameraRef} mode="video" facing="back" />
          ) : (
            <CameraPreview
              ref={driveCameraRef}
              source={drivePreviewSource}
              active
            />
          )
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
            <Text style={styles.recordingLabel}>Recording - {chunkCount} chunks</Text>
          </View>
        )}

        {recording && mode === 'drive' && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingLabel}>
              Drive - {driverEvents} bumps - {chunkCount} chunks
            </Text>
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
    backgroundColor: colors.parchment,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.parchment,
    gap: 12,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.hairline,
    borderRadius: radii.soft,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.canvas,
  },
  modeText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.muted,
  },
  modeTextActive: {
    color: colors.ink,
    fontWeight: '600',
  },
  cameraSection: {
    flex: 1,
    backgroundColor: colors.canvas,
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
    backgroundColor: colors.canvas,
  },
  permissionText: {
    fontSize: 16,
    color: colors.muted,
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
    backgroundColor: colors.hairline,
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
    borderColor: colors.canvas,
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
