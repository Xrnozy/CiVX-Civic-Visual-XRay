import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { api } from '../lib/api';

export default function DriverModeScreen() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState(0);
  const lastMag = useRef(1);

  useEffect(() => {
    api<{ id: string }>('/api/passive/sessions', { method: 'POST', body: JSON.stringify({ mode: 'driver' }) })
      .then((s) => setSessionId(s.id));
  }, []);

  useEffect(() => {
    Accelerometer.setUpdateInterval(200);
    const sub = Accelerometer.addListener(async ({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z);
      const delta = Math.abs(mag - lastMag.current);
      lastMag.current = mag;
      if (delta > 2.5 && sessionId) {
        const loc = await Location.getCurrentPositionAsync({});
        await api('/api/driver/sensor-events', {
          method: 'POST',
          body: JSON.stringify({
            route_session_id: sessionId,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            magnitude: delta,
            event_type: 'bump',
            event_timestamp: new Date().toISOString(),
          }),
        });
        setEvents((e) => e + 1);
      }
    });
    return () => sub.remove();
  }, [sessionId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Mode</Text>
      <Text style={styles.meta}>Monitoring road anomalies via accelerometer</Text>
      <Text style={styles.count}>{events} events detected</Text>
      <TouchableOpacity style={styles.btn} onPress={() => sessionId && api(`/api/passive/sessions/${sessionId}/end`, { method: 'POST' })}>
        <Text style={styles.btnText}>End Session</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '600' },
  meta: { fontSize: 17, color: '#333', marginTop: 8 },
  count: { fontSize: 48, fontWeight: '600', marginVertical: 32, color: '#0066cc' },
  btn: { backgroundColor: '#272729', borderRadius: 999, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff' },
});
