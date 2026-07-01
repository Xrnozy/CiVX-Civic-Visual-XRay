import { StatCard } from '../../ui/StatCard';
import { formatHours } from '../../../types/analytics';
import type { AnalyticsSummary } from '../../../types/analytics';

interface Props {
  summary: AnalyticsSummary | null;
}

export function AnalyticsSummaryCards({ summary }: Props) {
  const topBarangay = summary?.top_barangays?.[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Total reports" value={summary?.total_reports ?? '—'} />
      <StatCard label="Total resolved" value={summary?.total_resolved ?? '—'} />
      <StatCard
        label="Avg response time"
        value={formatHours(summary?.avg_response_time_hours)}
      />
      <StatCard
        label="Top barangay"
        value={topBarangay ? `${topBarangay.barangay} (${topBarangay.count})` : '—'}
      />
      <StatCard label="Active cleanups" value={summary?.active_cleanup_events ?? '—'} />
    </div>
  );
}
