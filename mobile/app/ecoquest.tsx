import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { api } from '../lib/api';

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
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.meta}>{item.task_type}</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>Open</Text></View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, backgroundColor: '#f8fafc' },
  headerCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  eyebrow: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#0066cc', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginTop: 6 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 6, lineHeight: 20 },
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 14, color: '#64748b', marginTop: 6, lineHeight: 20 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#0f172a', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginTop: 10 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
