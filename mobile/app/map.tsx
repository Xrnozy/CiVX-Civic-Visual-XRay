import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
