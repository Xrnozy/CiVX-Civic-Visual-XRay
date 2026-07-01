import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { api } from '../lib/api';

export default function EventDetailScreen() {
  const [permission, requestPermission] = useCameraPermissions();
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

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <TouchableOpacity onPress={requestPermission}>
          <Text>Grant camera permission to scan QR codes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!scanning) return <View style={styles.center}><Text>Scan complete</Text></View>;

  return (
    <View style={styles.flex}>
      <CameraView
        style={styles.flex}
        onBarcodeScanned={onScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <Text style={styles.hint}>Scan event QR code to check in</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { position: 'absolute', bottom: 40, alignSelf: 'center', color: '#fff', fontSize: 16 },
});
