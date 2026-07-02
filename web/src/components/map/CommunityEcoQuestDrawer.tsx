import { Link } from 'react-router-dom';
import { ProofBadges } from '../ecoquest/RequiredProofSection';

export interface EcoQuestMapTask {
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

interface Props {
  task: EcoQuestMapTask | null;
  loading: boolean;
  onClose: () => void;
  overlay?: boolean;
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export function CommunityEcoQuestDrawer({ task, loading, onClose, overlay = false }: Props) {
  if (loading && !task) {
    return (
      <aside
        className={
          overlay
            ? 'flex h-full w-full flex-col items-center justify-center rounded-[20px] border border-hairline bg-canvas shadow-2xl'
            : 'flex min-h-[320px] flex-col items-center justify-center rounded-[20px] border border-hairline bg-canvas'
        }
      >
        <p className="text-sm text-ink-muted-48">Loading task details…</p>
      </aside>
    );
  }

  if (!task) return null;

  return (
    <aside
      className={
        overlay
          ? 'flex h-full w-full flex-col overflow-hidden rounded-[20px] border border-hairline bg-canvas shadow-2xl'
          : 'flex max-h-[min(85vh,720px)] flex-col overflow-hidden rounded-[20px] border border-hairline bg-canvas'
      }
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 pb-4 pt-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#15803d]">EcoQuest task</p>
          <h2 className="mt-1 text-[21px] font-semibold text-ink">{task.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-sm text-ink-muted-48 hover:bg-canvas-parchment hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        <p className="text-sm capitalize text-ink-muted-48">{formatLabel(task.task_type)}</p>
        {task.description ? (
          <p className="mt-3 text-sm text-ink-muted-80">{task.description}</p>
        ) : null}
        <div className="mt-4 grid gap-3 text-sm">
          {task.barangay ? (
            <div>
              <span className="text-ink-muted-48">Area</span>
              <p className="font-medium text-ink">{task.barangay}</p>
            </div>
          ) : null}
          {task.reward_type ? (
            <div>
              <span className="text-ink-muted-48">Reward</span>
              <p className="font-medium text-ink">{task.reward_type}</p>
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted-48">Required proof</p>
          <ProofBadges proof={task.required_proof} />
        </div>
        <div className="mt-6 border-t border-hairline pt-4">
          <Link to="/mobile/ecoquest" className="btn-secondary-pill block w-full justify-center text-center">
            View in EcoQuest
          </Link>
        </div>
      </div>
    </aside>
  );
}
