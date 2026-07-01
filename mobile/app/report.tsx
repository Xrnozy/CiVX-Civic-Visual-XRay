import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import { ISSUE_CATEGORIES } from '../shared/constants';

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
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera access is needed</Text>
          <Text style={styles.permissionText}>Allow the camera so you can submit a photo report in seconds.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant camera permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Citizen reporting</Text>
        <Text style={styles.title}>Report an issue in a few taps.</Text>
        <Text style={styles.subtitle}>Capture a photo, tag the problem, and help the city respond faster.</Text>
      </View>

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

      <View style={styles.panel}>
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
        <TextInput style={styles.input} placeholder="Short description" value={description} onChangeText={setDescription} multiline />
        <TextInput style={styles.input} placeholder="Barangay or area (optional)" value={barangay} onChangeText={setBarangay} />

        {!canUseLocation && (
          <TouchableOpacity style={styles.permissionBtn} onPress={requestLocationPermission}>
            <Text style={styles.permissionBtnText}>Grant location permission</Text>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 24 },
  heroCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
  eyebrow: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#0066cc', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginTop: 6 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 6, lineHeight: 20 },
  cameraCard: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#0f172a', marginBottom: 14 },
  camera: { aspectRatio: 4 / 3 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(0,0,0,0.15)' },
  cameraHint: { color: '#fff', fontSize: 14, opacity: 0.9 },
  preview: { width: '100%', height: '100%', position: 'absolute', left: 0, top: 0 },
  capture: { alignSelf: 'center', backgroundColor: '#0066cc', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999 },
  captureText: { color: '#fff', fontWeight: '600' },
  panel: { backgroundColor: '#ffffff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 4, marginBottom: 8 },
  chipRow: { gap: 10, paddingBottom: 4 },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#fff', marginRight: 8 },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { color: '#0f172a', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, minHeight: 56, textAlignVertical: 'top', marginBottom: 10, backgroundColor: '#f8fafc' },
  permissionCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  permissionText: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  permissionBtn: { backgroundColor: '#0066cc', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, marginTop: 14 },
  permissionBtnText: { color: '#fff', fontWeight: '600' },
  resultCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, backgroundColor: '#f8fafc', marginTop: 6 },
  resultLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: '#64748b' },
  resultValue: { marginTop: 6, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  resultMeta: { marginTop: 4, fontSize: 13, color: '#64748b' },
  submit: { backgroundColor: '#0066cc', padding: 16, alignItems: 'center', borderRadius: 999, marginTop: 10 },
  submitDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
