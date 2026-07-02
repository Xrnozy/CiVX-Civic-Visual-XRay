import { StatCard } from '../../ui/StatCard';
import type { EventRoster } from '../../../types/attendance';

interface Props {
  summary: EventRoster['summary'] | null;
}

export function AttendanceSummaryBar({ summary }: Props) {
  const by = summary?.by_tracker_status ?? summary?.by_status;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Registered" value={by?.registered ?? 0} />
      <StatCard label="Checked in" value={by?.['checked-in'] ?? 0} />
      <StatCard label="Completed" value={by?.completed ?? 0} />
      <StatCard label="Service hours" value={summary?.total_verified_hours ?? 0} />
    </div>
  );
}
