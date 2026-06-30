import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import { ISSUE_CATEGORIES } from '../../shared/constants';

export default function ReportScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [issueType, setIssueType] = useState<string>('garbage_pile');
  const [description, setDescription] = useState('');
  const [barangay, setBarangay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ incident_id?: string; merged?: boolean } | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  const canUseCamera = Boolean(permission?.granted);
  const canUseLocation = Boolean(locationPermission?.granted);

  async function capture() {
    const ref = cameraRef.current as unknown as { takePictureAsync?: () => Promise<{ uri: string }> } | null;
    if (!ref?.takePictureAsync) return;
    const pic = await ref.takePictureAsync();
    setPhoto(pic.uri);
  }

  async function ensureLocationPermission(): Promise<boolean> {
    if (canUseLocation) return true;
    const result = await requestLocationPermission();
    return result.granted;
  }

  async function submit() {
    if (!photo) {
      Alert.alert('Photo required', 'Take a photo before submitting the report.');
      return;
    }
    const locationReady = await ensureLocationPermission();
    if (!locationReady) {
      Alert.alert('Location required', 'Grant location access so CiVX can place the report on the map.');
      return;
    }

    let loc;
    try {
      loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    } catch {
      Alert.alert('Location unavailable', 'Unable to read your current GPS position.');
      return;
    }

    const form = new FormData();
    form.append('latitude', String(loc.coords.latitude));
    form.append('longitude', String(loc.coords.longitude));
    form.append('description', description.trim() || 'Mobile report');
    form.append('issue_type', issueType);
    if (barangay.trim()) {
      form.append('barangay', barangay.trim());
    }
    form.append('photo', { uri: photo, name: 'report.jpg', type: 'image/jpeg' } as unknown as Blob);

    setSubmitting(true);
    try {
      const result = await api<{ incident_id?: string; merged?: boolean }>('/api/reports', { method: 'POST', body: form });
      setLastResult(result);
      Alert.alert(
        'Report submitted',
        result.incident_id
          ? `Incident: ${result.incident_id}${result.merged ? ' (merged)' : ''}`
          : 'Submitted successfully.',
      );
      setDescription('');
      setBarangay('');
      setPhoto(null);
      setIssueType('garbage_pile');
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!canUseCamera) {
    return (
      <View style={styles.center}>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionText}>Grant camera permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Report an issue</Text>
      <Text style={styles.subtitle}>Take a photo, mark the problem, and submit it to the LGU queue.</Text>

      <View style={styles.cameraCard}>
        <CameraView style={styles.camera} ref={cameraRef}>
          <View style={styles.cameraOverlay}>
            {photo ? <Image source={{ uri: photo }} style={styles.preview} /> : <Text style={styles.cameraHint}>Preview appears here after capture</Text>}
            <TouchableOpacity style={styles.capture} onPress={capture}>
              <Text style={styles.captureText}>{photo ? 'Retake' : 'Capture photo'}</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>

      <Text style={styles.sectionLabel}>Issue type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {ISSUE_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[styles.chip, issueType === category && styles.chipActive]}
            onPress={() => setIssueType(category)}
          >
            <Text style={[styles.chipText, issueType === category && styles.chipTextActive]}>{category.replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Details</Text>
      <TextInput
        style={styles.input}
        placeholder="Short description"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <TextInput
        style={styles.input}
        placeholder="Barangay or area (optional)"
        value={barangay}
        onChangeText={setBarangay}
      />

      {!canUseLocation && (
        <TouchableOpacity style={styles.permissionBtn} onPress={requestLocationPermission}>
          <Text style={styles.permissionText}>Grant location permission</Text>
        </TouchableOpacity>
      )}

      {lastResult?.incident_id && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Last submitted incident</Text>
          <Text style={styles.resultValue}>{lastResult.incident_id}</Text>
          <Text style={styles.resultMeta}>{lastResult.merged ? 'Merged into an existing incident' : 'Created as a new incident'}</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.submit, submitting && styles.submitDisabled]} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit report</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, gap: 12 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '600', color: '#1d1d1f' },
  subtitle: { fontSize: 16, color: '#7a7a7a', lineHeight: 22 },
  cameraCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  camera: { aspectRatio: 4 / 3 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(0,0,0,0.15)' },
  cameraHint: { color: '#fff', fontSize: 14, opacity: 0.9 },
  preview: { width: '100%', height: '100%', position: 'absolute', left: 0, top: 0 },
  capture: { alignSelf: 'center', backgroundColor: '#0066cc', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 999 },
  captureText: { color: '#fff', fontWeight: '600' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#1d1d1f', marginTop: 4 },
  chipRow: { gap: 10, paddingVertical: 4 },
  chip: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#1d1d1f', borderColor: '#1d1d1f' },
  chipText: { color: '#1d1d1f', fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 18, padding: 14, minHeight: 56, textAlignVertical: 'top' },
  permissionBtn: { backgroundColor: '#1d1d1f', padding: 14, alignItems: 'center', borderRadius: 999 },
  permissionText: { color: '#fff', fontWeight: '600' },
  resultCard: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 18, padding: 14, backgroundColor: '#fafafc' },
  resultLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: '#7a7a7a' },
  resultValue: { marginTop: 6, fontSize: 14, fontWeight: '600', color: '#1d1d1f' },
  resultMeta: { marginTop: 4, fontSize: 13, color: '#7a7a7a' },
  submit: { backgroundColor: '#0066cc', padding: 16, alignItems: 'center', borderRadius: 999, marginTop: 6 },
  submitDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
