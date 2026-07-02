import type { AttendanceStatus } from '../../types/attendance';
import { StatusBadge } from '../lgu/attendance/StatusBadge';

export interface OrganizerEventAttendee {
  user_id: string;
  full_name: string;
  phone_number?: string;
  email?: string;
  attendance_status: AttendanceStatus;
}

interface Props {
  attendees: OrganizerEventAttendee[];
  loading: boolean;
  error: string;
  approvalStatus: string;
}

export function OrganizerAttendeeRosterTable({
  attendees,
  loading,
  error,
  approvalStatus,
}: Props) {
  if (approvalStatus !== 'approved') {
    return (
      <p className="text-sm text-ink-muted-48">
        Volunteer roster appears after LGU approval.
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (loading) {
    return <p className="text-sm text-ink-muted-48">Loading attendees…</p>;
  }

  if (attendees.length === 0) {
    return <p className="text-sm text-ink-muted-48">No volunteers registered yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[16px] border border-hairline">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-canvas-parchment shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
          <tr className="border-b border-hairline text-ink-muted-80">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {attendees.map((attendee) => (
            <tr key={attendee.user_id} className="border-b border-hairline/60 last:border-0">
              <td className="px-3 py-2.5 font-medium text-ink">{attendee.full_name}</td>
              <td className="px-3 py-2.5 text-ink-muted-80">{attendee.phone_number || '—'}</td>
              <td className="px-3 py-2.5 text-ink-muted-80">{attendee.email || '—'}</td>
              <td className="px-3 py-2.5">
                <StatusBadge status={attendee.attendance_status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
