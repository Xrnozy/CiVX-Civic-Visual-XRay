import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../lib/api';
import { colors, productShadow, radii, type } from '../styles/theme';

type EcoQuestTask = {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  latitude?: number;
  longitude?: number;
  barangay?: string;
  required_proof?: Record<string, boolean>;
  reward_type?: string;
  status?: string;
  created_at?: string;
};

const DEFAULT_PROOF = {
  gps: true,
  before_photo: true,
  after_photo: true,
  qr_validation: true,
  group_leader_approval: true,
  lgu_approval: true,
};

function formatDate(value?: string) {
  if (!value) return 'Recently posted';
  return new Date(value).toLocaleString();
}

function statusLabel(value?: string) {
  return value?.replace(/_/g, ' ') || 'open';
}

export default function EcoQuestDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const taskId = typeof params.id === 'string' ? params.id : '';
  const [task, setTask] = useState<EcoQuestTask | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) {
      setLoading(false);
      return;
    }
    api<EcoQuestTask>(`/api/ecoquest/tasks/${taskId}`)
      .then(setTask)
      .catch(() => Alert.alert('Task unavailable', 'Unable to load this EcoQuest task.'))
      .finally(() => setLoading(false));
  }, [taskId]);

  const proof = useMemo(() => ({ ...DEFAULT_PROOF, ...(task?.required_proof || {}) }), [task?.required_proof]);
  const proofItems = [
    { key: 'gps', label: 'GPS check-in', icon: 'location-outline' },
    { key: 'before_photo', label: 'Before photo', icon: 'image-outline' },
    { key: 'after_photo', label: 'After photo', icon: 'images-outline' },
    { key: 'qr_validation', label: 'QR validation', icon: 'qr-code-outline' },
    { key: 'group_leader_approval', label: 'Group leader approval', icon: 'people-outline' },
    { key: 'lgu_approval', label: 'LGU approval', icon: 'shield-checkmark-outline' },
  ] as const;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Task not found</Text>
        <Text style={styles.emptyText}>This EcoQuest task may no longer be available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Ionicons name="sparkles" size={36} color={colors.primaryOnDark} />
        <Text style={styles.heroEyebrow}>EcoQuest</Text>
        <Text style={styles.heroTitle}>{task.title}</Text>
        <Text style={styles.heroMeta}>{statusLabel(task.task_type)} - {task.barangay || 'Community task'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Task details</Text>
        <Text style={styles.description}>{task.description || 'Task instructions will be updated by the LGU sponsor.'}</Text>

        <View style={styles.detailGrid}>
          <View style={styles.detailItem}>
            <Ionicons name="leaf-outline" size={20} color={colors.primary} />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Task type</Text>
              <Text style={styles.detailValue}>{statusLabel(task.task_type)}</Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Area</Text>
              <Text style={styles.detailValue}>{task.barangay || 'Assigned area'}</Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="gift-outline" size={20} color={colors.primary} />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Reward</Text>
              <Text style={styles.detailValue}>{task.reward_type || 'Community service credit'}</Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Posted</Text>
              <Text style={styles.detailValue}>{formatDate(task.created_at)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{statusLabel(task.status)}</Text>
          </View>
          {task.latitude && task.longitude ? (
            <Text style={styles.coordinates}>{task.latitude.toFixed(4)}, {task.longitude.toFixed(4)}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Verification checklist</Text>
        <Text style={styles.sectionCopy}>
          EcoQuest tasks are verified with structured proof before LGU approval. Rewards or money may require extra ID checks.
        </Text>
        <View style={styles.checklist}>
          {proofItems.map((item) => {
            const enabled = Boolean(proof[item.key]);
            return (
              <View key={item.key} style={[styles.checkItem, !enabled && styles.checkItemMuted]}>
                <Ionicons name={item.icon} size={20} color={enabled ? colors.primary : colors.muted} />
                <Text style={[styles.checkText, !enabled && styles.checkTextMuted]}>{item.label}</Text>
                <Ionicons name={enabled ? 'checkmark-circle' : 'remove-circle-outline'} size={18} color={enabled ? colors.successText : colors.muted} />
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={() => Alert.alert('Proof submission', 'Before/after photo upload and GPS proof capture will open from here.')}
        >
          <Text style={styles.submitButtonText}>Prepare proof submission</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment },
  container: { padding: 20, paddingBottom: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.parchment },
  hero: { backgroundColor: colors.tileDark, borderRadius: radii.card, padding: 24, alignItems: 'center', ...productShadow },
  heroEyebrow: { ...type.eyebrow, color: colors.primaryOnDark, marginTop: 12 },
  heroTitle: { color: colors.canvas, fontSize: 30, fontWeight: '600', lineHeight: 36, textAlign: 'center', marginTop: 8 },
  heroMeta: { color: colors.bodyMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, textTransform: 'capitalize' },
  card: { backgroundColor: colors.canvas, borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline, padding: 20, marginTop: 14 },
  eyebrow: { ...type.eyebrow, color: colors.primary },
  description: { color: colors.ink80, fontSize: 15, lineHeight: 22, marginTop: 8 },
  detailGrid: { gap: 12, marginTop: 18 },
  detailItem: { flexDirection: 'row', gap: 12, backgroundColor: colors.parchment, borderRadius: radii.soft, padding: 14 },
  detailTextWrap: { flex: 1 },
  detailLabel: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { color: colors.ink, fontSize: 15, fontWeight: '600', marginTop: 3, textTransform: 'capitalize' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  statusPill: { backgroundColor: colors.successBg, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  statusText: { color: colors.successText, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  coordinates: { color: colors.muted, fontSize: 12 },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '600' },
  sectionCopy: { color: colors.ink80, fontSize: 14, lineHeight: 21, marginTop: 8 },
  checklist: { gap: 10, marginTop: 16 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.parchment, borderRadius: radii.soft, padding: 14 },
  checkItemMuted: { opacity: 0.72 },
  checkText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  checkTextMuted: { color: colors.muted },
  submitButton: { backgroundColor: colors.primary, borderRadius: radii.pill, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  submitButtonText: { color: colors.canvas, fontSize: 16, fontWeight: '700' },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 14, marginTop: 6, textAlign: 'center' },
});
