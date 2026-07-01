import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ResponseTimes } from '../../../types/analytics';
import { formatHours } from '../../../types/analytics';

interface Props {
  data: ResponseTimes | null;
}

export function ResponseTimePanel({ data }: Props) {
  const weekly = data?.weekly ?? [];

  return (
    <div className="store-utility-card h-full">
      <h2 className="font-semibold">Response time tracking</h2>
      <p className="mt-1 text-sm text-ink-muted-48">Average durations across resolved incidents</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-canvas-parchment p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted-48">To verify</p>
          <p className="mt-1 text-2xl font-semibold">{formatHours(data?.avg_time_to_verify_hours)}</p>
          <p className="mt-1 text-xs text-ink-muted-48">n={data?.sample_size.time_to_verify ?? 0}</p>
        </div>
        <div className="rounded-xl bg-canvas-parchment p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted-48">To resolve</p>
          <p className="mt-1 text-2xl font-semibold">{formatHours(data?.avg_time_to_resolve_hours)}</p>
          <p className="mt-1 text-xs text-ink-muted-48">n={data?.sample_size.time_to_resolve ?? 0}</p>
        </div>
        <div className="rounded-xl bg-canvas-parchment p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted-48">Full lifecycle</p>
          <p className="mt-1 text-2xl font-semibold">{formatHours(data?.avg_total_lifecycle_hours)}</p>
          <p className="mt-1 text-xs text-ink-muted-48">n={data?.sample_size.total_lifecycle ?? 0}</p>
        </div>
      </div>

      <div className="mt-8 h-64">
        {weekly.length === 0 ? (
          <p className="text-sm text-ink-muted-48">Weekly trend appears once incidents have timestamps.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatHours(typeof value === 'number' ? value : null)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="avg_time_to_verify_hours"
                name="To verify"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="avg_time_to_resolve_hours"
                name="To resolve"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
