import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface Task {
  id: string;
  title: string;
  task_type: string;
  status: string;
}

export default function LGUEcoQuestPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    api<Task[]>('/api/ecoquest/tasks').then(setTasks).catch(() => setTasks([]));
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="text-[34px] font-semibold">EcoQuest Tasks</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {tasks.map((t) => (
          <div key={t.id} className="store-utility-card">
            <p className="font-semibold">{t.title}</p>
            <p className="text-sm">{t.task_type} · {t.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
