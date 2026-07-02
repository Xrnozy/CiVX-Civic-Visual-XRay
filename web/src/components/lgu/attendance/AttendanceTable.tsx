import { ButtonSecondaryPill } from '../../ui/Buttons';
import type { EventRoster, VolunteerAttendance } from '../../../types/attendance';
import { StatusBadge } from './StatusBadge';

function fmtTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function ValidBadge({ ok, label }: { ok: boolean | null | undefined; label: string }) {
  if (ok === null || ok === undefined) return <span className="text-xs text-ink-muted-48">{label}: —</span>;
  return (
    <span className={`text-xs font-medium ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
      {label}: {ok ? 'OK' : 'Fail'}
    </span>
  );
}

function TrackerStatusBadge({ status }: { status: string }) {
  const label =
    status === 'completed' ? 'Completed' : status === 'checked-in' ? 'Checked in' : status === 'rejected' ? 'Rejected' : 'Registered';
  const cls =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'checked-in'
        ? 'bg-sky-100 text-sky-800'
        : status === 'rejected'
          ? 'bg-red-100 text-red-700'
          : 'bg-stone-100 text-stone-700';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {label}
    </span>
  );
}

interface LguProps {
  mode: 'lgu';
  roster: EventRoster | null;
  onSelect: (v: VolunteerAttendance) => void;
}

interface OrganizerProps {
  mode: 'organizer';
  roster: EventRoster | null;
  onSelect?: (v: VolunteerAttendance) => void;
  onSendCertificate?: (v: VolunteerAttendance) => void;
  sendingUserId?: string | null;
}

type Props = LguProps | OrganizerProps;

export function AttendanceTable(props: Props) {
  const { roster, mode } = props;
  const rows = roster?.volunteers ?? [];
  const canSend = roster?.permissions?.can_send_certificate;

  if (!roster) {
    return <p className="text-sm text-ink-muted-48">Select an event to view attendance.</p>;
  }

  if (rows.length === 0) {
    return <p className="store-utility-card text-sm text-ink-muted-80">No volunteers registered for this event yet.</p>;
  }

  return (
    <div className="store-utility-card overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-ink-muted-80">
            <th className="px-3 py-2 font-medium">Volunteer</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Check-in</th>
            <th className="px-3 py-2 font-medium">Check-out</th>
            <th className="px-3 py-2 font-medium">Hours</th>
            <th className="px-3 py-2 font-medium">Validation</th>
            {mode === 'organizer' ? (
              <>
                <th className="px-3 py-2 font-medium">Certificate</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.user_id} className="border-b border-black/5 hover:bg-black/[0.02]">
              <td className="px-3 py-3">
                {mode === 'lgu' ? (
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => props.onSelect(v)}>
                    {v.full_name}
                  </button>
                ) : (
                  <span className="font-medium">{v.full_name}</span>
                )}
                {v.barangay && <p className="text-xs text-ink-muted-48">{v.barangay}</p>}
              </td>
              <td className="px-3 py-3">
                <TrackerStatusBadge status={v.tracker_status} />
              </td>
              <td className="px-3 py-3 text-xs">{fmtTime(v.check_in_time)}</td>
              <td className="px-3 py-3 text-xs">{fmtTime(v.check_out_time)}</td>
              <td className="px-3 py-3">
                <span title="Verified hours">{v.verified_hours}</span>
                <span className="text-xs text-ink-muted-48"> / {v.calculated_hours}</span>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <ValidBadge ok={v.gps_valid} label="GPS" />
                  <ValidBadge ok={v.qr_valid} label="QR" />
                </div>
              </td>
              {mode === 'organizer' ? (
                <>
                  <td className="px-3 py-3 text-xs">
                    {v.certificate_sent_at ? (
                      <span className="text-emerald-700" title={v.certificate_sent_to}>
                        Sent{v.certificate_sent_to ? ` · ${v.certificate_sent_to}` : ''}
                      </span>
                    ) : v.tracker_status === 'completed' ? (
                      v.email ? (
                        <span className="text-amber-700">Pending</span>
                      ) : (
                        <span className="text-ink-muted-48">No email</span>
                      )
                    ) : (
                      <span className="text-ink-muted-48">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canSend && v.tracker_status === 'completed' && v.email ? (
                      <ButtonSecondaryPill
                        className="!px-2 !py-1 text-xs"
                        disabled={props.sendingUserId === v.user_id}
                        onClick={() => props.onSendCertificate?.(v)}
                      >
                        {props.sendingUserId === v.user_id ? 'Sending…' : v.certificate_sent_at ? 'Resend' : 'Send'}
                      </ButtonSecondaryPill>
                    ) : null}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Re-export StatusBadge for other consumers
export { StatusBadge };
