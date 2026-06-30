import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as Location from 'expo-location';
import { api } from '../lib/api';

export default function EventDetailScreen() {
  const [scanning, setScanning] = useState(true);

  async function onScan({ data }: { data: string }) {
    setScanning(false);
    const loc = await Location.getCurrentPositionAsync({});
    const eventId = 'EVENT_ID'; // pass via route params in production
    try {
      await api(`/api/attendance/events/${eventId}/check-in`, {
        method: 'POST',
        body: JSON.stringify({
          qr_code_id: data,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        }),
      });
      Alert.alert('Checked in!');
    } catch (e) {
      Alert.alert('Check-in failed', String(e));
    }
  }

  if (!scanning) return <View style={styles.center}><Text>Scan complete</Text></View>;

  return (
    <View style={styles.flex}>
      <BarCodeScanner onBarCodeScanned={onScan} style={styles.flex} />
      <Text style={styles.hint}>Scan event QR code to check in</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { position: 'absolute', bottom: 40, alignSelf: 'center', color: '#fff', fontSize: 16 },
});
