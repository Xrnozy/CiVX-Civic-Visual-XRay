import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { Footer } from '../components/ui/Footer';
import { ProofBadges } from '../components/ecoquest/RequiredProofSection';
import { api } from '../lib/api';

interface EcoQuestTask {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  barangay?: string;
  reward_type?: string;
  status: string;
  required_proof?: {
    gps?: boolean;
    before_photo?: boolean;
    after_photo?: boolean;
    qr?: boolean;
  };
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export default function EcoQuestCheckInPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<EcoQuestTask | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!taskId) return;
    api<EcoQuestTask>(`/api/ecoquest/tasks/${taskId}`)
      .then(setTask)
      .catch(() => setError('Task not found or unavailable.'));
  }, [taskId]);

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <GlobalNav />
      <div className="page-content py-12">
        {error ? (
          <div className="mx-auto max-w-lg text-center">
            <p className="text-lg font-semibold text-ink">{error}</p>
            <Link to="/mobile/ecoquest" className="mt-4 inline-block text-sm text-primary underline">
              Browse EcoQuest tasks
            </Link>
          </div>
        ) : !task ? (
          <p className="text-center text-sm text-ink-muted-48">Loading task…</p>
        ) : (
          <div className="mx-auto max-w-lg store-utility-card">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">EcoQuest</p>
            <h1 className="mt-2 text-2xl font-semibold text-ink">{task.title}</h1>
            <p className="mt-1 text-sm text-ink-muted-48 capitalize">{formatLabel(task.task_type)}</p>
            {task.description ? (
              <p className="mt-4 text-sm text-ink-muted-80">{task.description}</p>
            ) : null}
            <div className="mt-4 space-y-1 text-sm text-ink-muted-48">
              {task.barangay ? <p>Area: {task.barangay}</p> : null}
              {task.reward_type ? <p>Reward: {task.reward_type}</p> : null}
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted-48">Required proof</p>
              <ProofBadges proof={task.required_proof} />
            </div>
            <p className="mt-6 rounded-[12px] border border-hairline bg-canvas-parchment px-4 py-3 text-sm text-ink-muted-80">
              You scanned the task QR. Open the EcoQuest app to submit your before/after photos and GPS check-in.
            </p>
            <Link to="/mobile/ecoquest" className="btn-primary mt-6 block w-full justify-center text-center">
              Open EcoQuest
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
