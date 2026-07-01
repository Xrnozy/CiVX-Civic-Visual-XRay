import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { api } from '../../lib/api';
import { colors, productShadow, radii, type } from '../../styles/theme';
import ProfileAvatarButton from '../../components/ProfileAvatarButton';

interface Task {
  id: string;
  title: string;
  task_type: string;
}

export default function EcoQuestScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    api<Task[]>('/api/ecoquest/tasks?status=open').then(setTasks).catch(() => setTasks([]));
  }, []);

  return (
    <View style={styles.screen}>
      <ProfileAvatarButton />
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <Text style={styles.eyebrow}>EcoQuest</Text>
            <Text style={styles.title}>Join micro-tasks that improve your neighborhood.</Text>
            <Text style={styles.subtitle}>Each task includes proof requirements such as GPS, before-and-after photos, or QR validation.</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No open quests yet</Text>
            <Text style={styles.emptyText}>New barangay tasks will appear here when LGU teams publish them.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.meta}>{item.task_type}</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>Open</Text></View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment },
  container: { padding: 20, paddingTop: 68, paddingBottom: 40, backgroundColor: colors.parchment },
  headerCard: { backgroundColor: colors.tileDark, borderRadius: radii.card, padding: 22, borderWidth: 1, borderColor: colors.tileDark2, marginBottom: 12, ...productShadow },
  eyebrow: { ...type.eyebrow, color: colors.primaryOnDark },
  title: { fontSize: 28, fontWeight: '600', color: colors.canvas, marginTop: 8, lineHeight: 34 },
  subtitle: { fontSize: 15, color: colors.bodyMuted, marginTop: 8, lineHeight: 22 },
  card: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.card, padding: 18, marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20, textTransform: 'capitalize' },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.ink, borderRadius: radii.pill, paddingVertical: 6, paddingHorizontal: 10, marginTop: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyCard: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.card, padding: 18 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
});
