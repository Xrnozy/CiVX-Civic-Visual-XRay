import { useEffect, useState } from 'react';

interface Task {
  id: string;
  title: string;
  task_type: string;
  description?: string;
  barangay?: string;
  status?: string;
  reward_type?: string;
  created_at?: string;
}

const proofItems = ['GPS check-in', 'Before photo', 'After photo', 'QR validation', 'LGU approval'];

function label(value?: string) {
  return value?.replace(/_/g, ' ') || 'open';
}

function formatDate(value?: string) {
  if (!value) return 'Recently posted';
  return new Date(value).toLocaleString();
}

export default function MobileEcoQuest() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    fetch('/api/ecoquest/tasks?status=open')
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);

  return (
    <div className="mobile-list-screen">
      <section className="mobile-list-hero mobile-list-hero-dark">
        <p className="mobile-native-eyebrow">EcoQuest</p>
        <h1>Neighborhood micro-tasks</h1>
        <p>Complete proof-backed tasks with GPS, photos, and LGU verification.</p>
      </section>

      {tasks.length === 0 ? (
        <div className="mobile-native-empty">No open quests published yet.</div>
      ) : (
        <div className="mobile-native-list">
          {tasks.map((task) => (
            <button key={task.id} type="button" className="mobile-native-list-card" onClick={() => setSelectedTask(task)}>
              <em>{label(task.task_type)}</em>
              <strong>{task.title}</strong>
              <span>{task.barangay || 'Nearby'} - {label(task.status)}</span>
              {task.description ? <p>{task.description}</p> : null}
            </button>
          ))}
        </div>
      )}

      {selectedTask ? (
        <div className="mobile-native-sheet-backdrop" onClick={() => setSelectedTask(null)}>
          <section className="mobile-native-detail-sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mobile-native-sheet-close" onClick={() => setSelectedTask(null)}>Close</button>
            <p className="mobile-native-eyebrow">EcoQuest</p>
            <h2>{selectedTask.title}</h2>
            <p className="mobile-native-detail-copy">
              {selectedTask.description || 'Task instructions will be updated by the LGU sponsor.'}
            </p>
            <div className="mobile-native-detail-grid">
              <div><span>Task type</span><strong>{label(selectedTask.task_type)}</strong></div>
              <div><span>Area</span><strong>{selectedTask.barangay || 'Assigned area'}</strong></div>
              <div><span>Reward</span><strong>{selectedTask.reward_type || 'Community service credit'}</strong></div>
              <div><span>Posted</span><strong>{formatDate(selectedTask.created_at)}</strong></div>
            </div>
            <h3 className="mobile-native-checklist-title">Verification checklist</h3>
            <div className="mobile-native-checklist">
              {proofItems.map((item) => <span key={item}>{item}</span>)}
            </div>
            <button type="button" className="mobile-native-full-button">Prepare proof submission</button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
