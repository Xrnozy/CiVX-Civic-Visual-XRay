import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { api } from '../lib/api';

export default function ReportScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const cameraRef = useState<{ takePictureAsync: () => Promise<{ uri: string }> } | null>(null);

  async function submit() {
    const loc = await Location.getCurrentPositionAsync({});
    const form = new FormData();
    form.append('latitude', String(loc.coords.latitude));
    form.append('longitude', String(loc.coords.longitude));
    form.append('description', 'Mobile report');
    if (photo) {
      form.append('photo', { uri: photo, name: 'report.jpg', type: 'image/jpeg' } as unknown as Blob);
    }
    try {
      const result = await api('/api/reports', { method: 'POST', body: form });
      Alert.alert('Report submitted', `Incident: ${(result as { incident_id: string }).incident_id}`);
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <TouchableOpacity onPress={requestPermission}><Text>Grant camera permission</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView style={styles.flex} ref={(r) => { (cameraRef as unknown as { current: unknown }).current = r; }}>
        <TouchableOpacity
          style={styles.capture}
          onPress={async () => {
            const ref = (cameraRef as unknown as { current: { takePictureAsync: () => Promise<{ uri: string }> } }).current;
            if (ref) {
              const pic = await ref.takePictureAsync();
              setPhoto(pic.uri);
            }
          }}
        >
          <Text style={styles.captureText}>Capture</Text>
        </TouchableOpacity>
      </CameraView>
      <TouchableOpacity style={styles.submit} onPress={submit}><Text style={styles.btnText}>Submit Report</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  capture: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#0066cc', padding: 16, borderRadius: 999 },
  captureText: { color: '#fff' },
  submit: { backgroundColor: '#0066cc', padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17 },
});
