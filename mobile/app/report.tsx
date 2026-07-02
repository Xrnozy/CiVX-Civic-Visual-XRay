import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput, Image, ActivityIndicator, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { ISSUE_CATEGORIES } from '../shared/constants';
import { colors, productShadow, radii, type } from '../styles/theme';

function formatIssueType(issue: string) {
  return issue.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ReportScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [issueType, setIssueType] = useState<string>('garbage_pile');
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [barangay, setBarangay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ incident_id?: string; merged?: boolean } | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  const canUseCamera = Boolean(permission?.granted);
  const canUseLocation = Boolean(locationPermission?.granted);

  async function capture() {
    if (photo) {
      setPhoto(null);
      return;
    }
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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentInsetAdjustmentBehavior="always"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Citizen reporting</Text>
          <Text style={styles.title}>Report an issue in a few taps.</Text>
          <Text style={styles.subtitle}>Capture a photo, tag the problem, and help the city respond faster.</Text>
        </View>

        <View style={styles.cameraCard}>
          <CameraView style={styles.camera} ref={cameraRef}>
            <View style={styles.cameraOverlay}>
              {photo ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover" />
                </View>
              ) : (
                <Text style={styles.cameraHint}>Preview appears here after capture</Text>
              )}
              <TouchableOpacity style={styles.capture} onPress={capture}>
                <Text style={styles.captureText}>{photo ? 'Retake' : 'Capture photo'}</Text>
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>Issue type</Text>
          <TouchableOpacity
            style={styles.select}
            activeOpacity={0.8}
            onPress={() => setIssuePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Select issue type"
          >
            <Text style={styles.selectValue}>{formatIssueType(issueType)}</Text>
            <Ionicons name="chevron-down" size={20} color={colors.muted} />
          </TouchableOpacity>

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

        <Modal visible={issuePickerOpen} transparent animationType="fade" onRequestClose={() => setIssuePickerOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIssuePickerOpen(false)}>
            <Pressable style={styles.issueSheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Issue type</Text>
                <TouchableOpacity style={styles.closeButton} onPress={() => setIssuePickerOpen(false)} accessibilityRole="button" accessibilityLabel="Close issue type picker">
                  <Ionicons name="close" size={20} color={colors.ink} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.issueList} showsVerticalScrollIndicator={false}>
                {ISSUE_CATEGORIES.map((category) => {
                  const selected = issueType === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[styles.issueOption, selected && styles.issueOptionActive]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setIssueType(category);
                        setIssuePickerOpen(false);
                      }}
                    >
                      <Text style={[styles.issueOptionText, selected && styles.issueOptionTextActive]}>{formatIssueType(category)}</Text>
                      {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment },
  scroller: { flex: 1, backgroundColor: colors.parchment },
  container: { padding: 20, paddingBottom: 56, backgroundColor: colors.parchment },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.parchment, padding: 24 },
  heroCard: { backgroundColor: colors.canvas, borderRadius: radii.card, padding: 22, borderWidth: 1, borderColor: colors.hairline, marginBottom: 14, ...productShadow },
  eyebrow: { ...type.eyebrow, color: colors.primary },
  title: { fontSize: 30, fontWeight: '600', color: colors.ink, marginTop: 6, lineHeight: 36 },
  subtitle: { fontSize: 15, color: colors.ink80, marginTop: 8, lineHeight: 22 },
  cameraCard: { borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.tileDark, marginBottom: 14, ...productShadow },
  camera: { aspectRatio: 4 / 3 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(0,0,0,0.15)' },
  cameraHint: { color: '#fff', fontSize: 14, opacity: 0.9 },
  previewWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.tileDark },
  preview: { width: '100%', height: '100%' },
  capture: { alignSelf: 'center', backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 18, borderRadius: radii.pill },
  captureText: { color: '#fff', fontWeight: '600' },
  panel: { backgroundColor: colors.canvas, borderRadius: radii.card, padding: 18, borderWidth: 1, borderColor: colors.hairline },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 4, marginBottom: 8 },
  select: { minHeight: 54, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.soft, paddingHorizontal: 14, marginBottom: 14, backgroundColor: colors.pearl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { color: colors.ink, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 12 },
  input: { borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.soft, padding: 14, minHeight: 56, textAlignVertical: 'top', marginBottom: 10, backgroundColor: colors.pearl, color: colors.ink },
  permissionCard: { backgroundColor: colors.canvas, borderRadius: radii.card, padding: 22, borderWidth: 1, borderColor: colors.hairline, alignItems: 'center', ...productShadow },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  permissionText: { fontSize: 14, color: colors.muted, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  permissionBtn: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 18, borderRadius: radii.pill, marginTop: 14 },
  permissionBtnText: { color: '#fff', fontWeight: '600' },
  resultCard: { borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.soft, padding: 14, backgroundColor: colors.parchment, marginTop: 6 },
  resultLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.muted },
  resultValue: { marginTop: 6, fontSize: 14, fontWeight: '700', color: colors.ink },
  resultMeta: { marginTop: 4, fontSize: 13, color: colors.muted },
  submit: { backgroundColor: colors.primary, padding: 16, alignItems: 'center', borderRadius: radii.pill, marginTop: 10 },
  submitDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end', padding: 16 },
  issueSheet: { maxHeight: '78%', backgroundColor: colors.canvas, borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden', ...productShadow },
  sheetHeader: { minHeight: 58, paddingLeft: 18, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  issueList: { paddingVertical: 6 },
  issueOption: { minHeight: 50, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  issueOptionActive: { backgroundColor: colors.pearl },
  issueOptionText: { color: colors.ink80, fontSize: 15, flex: 1, marginRight: 12 },
  issueOptionTextActive: { color: colors.ink, fontWeight: '700' },
});
