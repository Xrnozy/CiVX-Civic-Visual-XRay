import { StatCard } from '../../ui/StatCard';
import type { EventRoster } from '../../../types/attendance';

interface Props {
  summary: EventRoster['summary'] | null;
}

export function AttendanceSummaryBar({ summary }: Props) {
  const by = summary?.by_status;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <StatCard label="Registered" value={by?.registered ?? 0} />
      <StatCard label="Checked in" value={by?.['checked-in'] ?? 0} />
      <StatCard label="Checked out" value={by?.['checked-out'] ?? 0} />
      <StatCard label="Verified" value={by?.verified ?? 0} />
      <StatCard label="Rejected" value={by?.rejected ?? 0} />
      <StatCard label="Verified hours" value={summary?.total_verified_hours ?? 0} />
    </div>
  );
}
