import { useEffect, useState } from 'react';

interface Task {
  id: string;
  title: string;
  task_type: string;
  description?: string;
  barangay?: string;
  status?: string;
}

export default function MobileEcoQuest() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetch('/api/ecoquest/tasks?status=open')
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);

  return (
    <div className="space-y-3 p-4">
      <div className="ui-card">
        <p className="ui-card-title">EcoQuest</p>
        <h2 className="mt-1 text-lg font-semibold">Neighborhood micro-tasks</h2>
        <p className="mt-2 text-sm text-ink-muted-48">
          Complete proof-backed tasks with GPS, photos, and LGU verification.
        </p>
      </div>
      {tasks.length === 0 ? (
        <div className="ui-card text-sm text-ink-muted-48">No open quests published yet.</div>
      ) : (
        tasks.map((t) => (
          <article key={t.id} className="ui-card">
            <p className="text-xs font-medium uppercase text-primary">{t.task_type.replace(/_/g, ' ')}</p>
            <h3 className="mt-1 font-semibold">{t.title}</h3>
            <p className="text-xs text-ink-muted-48">{t.barangay || 'Nearby'}</p>
            {t.description ? <p className="mt-2 text-sm">{t.description}</p> : null}
          </article>
        ))
      )}
    </div>
  );
}
