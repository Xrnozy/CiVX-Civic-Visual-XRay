import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { api } from '../lib/api';

const CENTER = { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export default function MapScreen() {
  const [markers, setMarkers] = useState<Array<{ id: string; latitude: number; longitude: number; primary_issue_type?: string }>>([]);

  useEffect(() => {
    api<{ incidents: Array<{ id: string; latitude: number; longitude: number; primary_issue_type: string }> }>('/api/maps/markers')
      .then((d) => setMarkers(d.incidents))
      .catch(() => setMarkers([]));
  }, []);

  return (
    <View style={styles.flex}>
      <MapView style={styles.flex} initialRegion={CENTER}>
        {markers.map((m) => (
          <Marker key={m.id} coordinate={{ latitude: m.latitude, longitude: m.longitude }} title={m.primary_issue_type} />
        ))}
      </MapView>
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Nearby civic activity</Text>
        <Text style={styles.overlaySubtitle}>Tap markers to see issues, cleanup events, and active volunteer work.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f8fafc' },
  overlay: { position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  overlayTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  overlaySubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 },
});
