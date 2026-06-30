import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

const CHUNK_MS = 10000;

export default function PassiveModeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const chunkIndex = useRef(0);
  const gpsTrace = useRef<Array<{ t: number; lat: number; lng: number }>>([]);
  const cameraRef = useRef<CameraView | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startSession() {
    const session = await api<{ id: string }>('/api/passive/sessions', {
      method: 'POST',
      body: JSON.stringify({ mode: 'passive' }),
    });
    setSessionId(session.id);
    setRecording(true);
    timerRef.current = setInterval(captureChunk, CHUNK_MS);
  }

  async function captureChunk() {
    if (!sessionId || !cameraRef.current) return;
    const loc = await Location.getCurrentPositionAsync({});
    const t = chunkIndex.current * (CHUNK_MS / 1000);
    gpsTrace.current.push({ t, lat: loc.coords.latitude, lng: loc.coords.longitude });
    try {
      const pic = await (cameraRef.current as unknown as { takePictureAsync: () => Promise<{ uri: string }> }).takePictureAsync();
      const form = new FormData();
      form.append('chunk_index', String(chunkIndex.current));
      form.append('start_time', new Date().toISOString());
      form.append('end_time', new Date(Date.now() + CHUNK_MS).toISOString());
      form.append('gps_trace_json', JSON.stringify(gpsTrace.current));
      form.append('video', { uri: pic.uri, name: `chunk_${chunkIndex.current}.mp4`, type: 'video/mp4' } as unknown as Blob);
      await api(`/api/passive/sessions/${sessionId}/chunks`, { method: 'POST', body: form });
      chunkIndex.current += 1;
    } catch {
      const queue = JSON.parse((await AsyncStorage.getItem('chunk_queue')) || '[]');
      queue.push({ sessionId, index: chunkIndex.current });
      await AsyncStorage.setItem('chunk_queue', JSON.stringify(queue));
    }
  }

  function stopSession() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    if (sessionId) api(`/api/passive/sessions/${sessionId}/end`, { method: 'POST' });
  }

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <TouchableOpacity onPress={requestPermission}><Text>Grant camera</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView style={styles.flex} ref={cameraRef} />
      <View style={styles.controls}>
        {!recording ? (
          <TouchableOpacity style={styles.btn} onPress={startSession}><Text style={styles.btnText}>Start Passive Mode</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnStop} onPress={stopSession}><Text style={styles.btnText}>Stop · Chunk {chunkIndex.current}</Text></TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: { padding: 16 },
  btn: { backgroundColor: '#0066cc', borderRadius: 999, padding: 16, alignItems: 'center' },
  btnStop: { backgroundColor: '#272729', borderRadius: 999, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17 },
});
