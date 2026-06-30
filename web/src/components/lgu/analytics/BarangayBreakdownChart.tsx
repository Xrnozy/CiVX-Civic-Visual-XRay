import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BarangayBreakdown } from '../../../types/analytics';
import { formatStatus } from '../../../types/analytics';

const STATUS_COLORS: Record<string, string> = {
  detected: '#94a3b8',
  pending_review: '#f59e0b',
  verified: '#3b82f6',
  assigned: '#6366f1',
  ongoing: '#8b5cf6',
  resolved: '#22c55e',
  archived: '#64748b',
};

interface Props {
  data: BarangayBreakdown | null;
}

export function BarangayBreakdownChart({ data }: Props) {
  const totals = data?.totals_by_barangay ?? {};
  const barangays = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);

  const statuses = Array.from(
    new Set((data?.items ?? []).map((item) => item.status)),
  ).sort();

  const chartData = barangays.map((barangay) => {
    const row: Record<string, string | number> = { barangay };
    for (const status of statuses) {
      row[status] =
        data?.items
          .filter((item) => item.barangay === barangay && item.status === status)
          .reduce((sum, item) => sum + item.count, 0) ?? 0;
    }
    return row;
  });

  return (
    <div className="store-utility-card h-full">
      <h2 className="font-semibold">Reports by barangay</h2>
      <p className="mt-1 text-sm text-ink-muted-48">Stacked by incident status</p>
      <div className="mt-6 h-80">
        {chartData.length === 0 ? (
          <p className="text-sm text-ink-muted-48">No report data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="barangay"
                tick={{ fontSize: 11 }}
                angle={-25}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [value, 'Reports']} />
              <Legend formatter={(value) => formatStatus(String(value))} />
              {statuses.map((status) => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="reports"
                  fill={STATUS_COLORS[status] ?? '#0066cc'}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {(data?.items.length ?? 0) > 0 && (
        <div className="mt-6 overflow-x-auto">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted-48">
            Category & status detail
          </p>
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="border-b border-hairline text-ink-muted-48">
                <th className="py-2 pr-3 font-medium">Barangay</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {[...(data?.items ?? [])]
                .sort((a, b) => b.count - a.count)
                .slice(0, 12)
                .map((item) => (
                  <tr key={`${item.barangay}-${item.issue_type}-${item.status}`} className="border-b border-divider-soft">
                    <td className="py-2 pr-3">{item.barangay}</td>
                    <td className="py-2 pr-3">{item.issue_type.replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-3">{formatStatus(item.status)}</td>
                    <td className="py-2">{item.count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
