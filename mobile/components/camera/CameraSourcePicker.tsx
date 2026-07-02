import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { VideoInput } from '../../types/camera';

type Props = {
  inputs: VideoInput[];
  selectedId: string;
  loading?: boolean;
  onSelect: (input: VideoInput) => void;
  onRefresh: () => void;
};

export default function CameraSourcePicker({
  inputs,
  selectedId,
  loading,
  onSelect,
  onRefresh,
}: Props) {
  const externalCount = inputs.filter((input) => input.kind === 'external-device').length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Camera source</Text>
        <View style={styles.headerActions}>
          {loading ? <ActivityIndicator size="small" color="#0066cc" /> : null}
          <Pressable style={styles.refreshButton} onPress={onRefresh}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.help}>
        {externalCount > 0
          ? 'External cameras are connected directly inside CiVX. Select one below.'
          : 'Connect a USB webcam with an OTG adapter, tap Refresh, then choose USB / External camera.'}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {inputs.map((input) => {
          const active = input.id === selectedId;
          return (
            <Pressable
              key={input.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(input)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={2}>
                {input.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  help: {
    fontSize: 13,
    color: '#636366',
    lineHeight: 18,
  },
  refreshButton: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#d1d1d6',
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0066cc',
  },
  chips: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    maxWidth: 180,
    backgroundColor: '#e5e5ea',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#0066cc',
  },
  chipText: {
    fontSize: 13,
    color: '#1d1d1f',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#ffffff',
  },
});
