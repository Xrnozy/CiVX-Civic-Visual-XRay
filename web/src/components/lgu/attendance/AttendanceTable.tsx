import { ButtonPrimary, ButtonSecondaryPill } from '../../ui/Buttons';
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

interface Props {
  roster: EventRoster | null;
  onSelect: (v: VolunteerAttendance) => void;
  onOrganizerVerify: (userId: string) => void;
  onOrganizerReject: (userId: string) => void;
  onLguVerify: (userId: string) => void;
  onLguReject: (userId: string) => void;
  onCertificate: (v: VolunteerAttendance) => void;
}

export function AttendanceTable({
  roster,
  onSelect,
  onOrganizerVerify,
  onOrganizerReject,
  onLguVerify,
  onLguReject,
  onCertificate,
}: Props) {
  const perms = roster?.permissions;
  const rows = roster?.volunteers ?? [];

  if (!roster) {
    return <p className="text-sm text-ink-muted-48">Select an event to view attendance.</p>;
  }

  if (rows.length === 0) {
    return <p className="store-utility-card text-sm text-ink-muted-80">No volunteers registered for this event yet.</p>;
  }

  return (
    <div className="store-utility-card overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-ink-muted-80">
            <th className="px-3 py-2 font-medium">Volunteer</th>
            <th className="px-3 py-2 font-medium">Organizer</th>
            <th className="px-3 py-2 font-medium">LGU</th>
            <th className="px-3 py-2 font-medium">Check-in</th>
            <th className="px-3 py-2 font-medium">Check-out</th>
            <th className="px-3 py-2 font-medium">Hours</th>
            <th className="px-3 py-2 font-medium">Validation</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.user_id} className="border-b border-black/5 hover:bg-black/[0.02]">
              <td className="px-3 py-3">
                <button type="button" className="text-left font-medium hover:underline" onClick={() => onSelect(v)}>
                  {v.full_name}
                </button>
                {v.barangay && <p className="text-xs text-ink-muted-48">{v.barangay}</p>}
              </td>
              <td className="px-3 py-3"><StatusBadge status={v.organizer_status} /></td>
              <td className="px-3 py-3"><StatusBadge status={v.lgu_status} /></td>
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
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1">
                  {perms?.can_organizer_verify && v.organizer_status !== 'verified' && (
                    <ButtonSecondaryPill className="!px-2 !py-1 text-xs" onClick={() => onOrganizerVerify(v.user_id)}>
                      Org ✓
                    </ButtonSecondaryPill>
                  )}
                  {perms?.can_organizer_verify && v.organizer_status !== 'rejected' && (
                    <ButtonSecondaryPill className="!px-2 !py-1 text-xs" onClick={() => onOrganizerReject(v.user_id)}>
                      Org ✗
                    </ButtonSecondaryPill>
                  )}
                  {perms?.can_lgu_verify && v.lgu_status !== 'verified' && (
                    <ButtonPrimary className="!px-2 !py-1 text-xs" onClick={() => onLguVerify(v.user_id)}>
                      LGU ✓
                    </ButtonPrimary>
                  )}
                  {perms?.can_lgu_verify && v.lgu_status !== 'rejected' && (
                    <ButtonSecondaryPill className="!px-2 !py-1 text-xs" onClick={() => onLguReject(v.user_id)}>
                      LGU ✗
                    </ButtonSecondaryPill>
                  )}
                  {v.lgu_status === 'verified' && (
                    <ButtonSecondaryPill className="!px-2 !py-1 text-xs" onClick={() => onCertificate(v)}>
                      Certificate
                    </ButtonSecondaryPill>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
