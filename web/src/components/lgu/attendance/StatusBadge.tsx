import type { AttendanceStatus } from '../../../types/attendance';

const STYLES: Record<AttendanceStatus, string> = {
  registered: 'bg-slate-100 text-slate-700',
  'checked-in': 'bg-sky-100 text-sky-800',
  'checked-out': 'bg-amber-100 text-amber-900',
  verified: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] || STYLES.registered}`}>
      {status}
    </span>
  );
}
