import { PUBLIC_WORKER_TYPES, type PublicWorkerType } from '../../types/user';

interface WorkerTypeSelectProps {
  value: string;
  onChange: (value: PublicWorkerType) => void;
  required?: boolean;
}

export function WorkerTypeSelect({ value, onChange, required }: WorkerTypeSelectProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-ink">Type of public worker</label>
      <select
        className="auth-input"
        value={value}
        onChange={(e) => onChange(e.target.value as PublicWorkerType)}
        required={required}
      >
        <option value="">Select your role</option>
        {Object.entries(PUBLIC_WORKER_TYPES).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <p className="text-xs text-ink-muted-48">This helps your LGU assign the right routes and tools.</p>
    </div>
  );
}
