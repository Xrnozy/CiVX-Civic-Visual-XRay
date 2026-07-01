import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { VideoInput } from '../../types/camera';

type Props = {
  inputs: VideoInput[];
  selectedId: string;
  loading?: boolean;
  onSelect: (input: VideoInput) => void;
  streamUrl: string;
  onStreamUrlChange: (value: string) => void;
  onSaveStreamUrl: () => void;
};

export default function CameraSourcePicker({
  inputs,
  selectedId,
  loading,
  onSelect,
  streamUrl,
  onStreamUrlChange,
  onSaveStreamUrl,
}: Props) {
  const selected = inputs.find((input) => input.id === selectedId);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Camera source</Text>
        {loading ? <ActivityIndicator size="small" color="#0066cc" /> : null}
      </View>

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

      {selected?.kind === 'external-stream' ? (
        <View style={styles.streamBox}>
          <Text style={styles.streamHelp}>
            Paste an MJPEG or HTTP stream URL from your connected webcam or dashcam app.
          </Text>
          <TextInput
            value={streamUrl}
            onChangeText={onStreamUrlChange}
            placeholder="http://192.168.1.10:8080/video"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Pressable style={styles.saveButton} onPress={onSaveStreamUrl}>
            <Text style={styles.saveButtonText}>Save stream URL</Text>
          </Pressable>
        </View>
      ) : null}
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
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
  streamBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  streamHelp: {
    fontSize: 13,
    color: '#636366',
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1d1d1f',
    backgroundColor: '#fafafa',
  },
  saveButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0066cc',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
