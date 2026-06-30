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
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{item.task_type}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 18, padding: 16, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 14, color: '#7a7a7a' },
});
