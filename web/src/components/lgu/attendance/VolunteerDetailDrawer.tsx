import type { EventRoster, VolunteerAttendance } from '../../../types/attendance';
import { StatusBadge } from './StatusBadge';

interface Props {
  volunteer: VolunteerAttendance | null;
  permissions: EventRoster['permissions'] | null;
  onClose: () => void;
}

function fmtTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function VolunteerDetailDrawer({ volunteer, permissions, onClose }: Props) {
  if (!volunteer) return null;

  const mapsUrl =
    volunteer.check_in_latitude != null && volunteer.check_in_longitude != null
      ? `https://www.google.com/maps?q=${volunteer.check_in_latitude},${volunteer.check_in_longitude}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-canvas p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{volunteer.full_name}</h2>
            {volunteer.barangay && <p className="text-sm text-ink-muted-80">{volunteer.barangay}</p>}
          </div>
          <button type="button" className="text-sm text-ink-muted-48 hover:text-ink" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4 text-sm">
          <div>
            <p className="text-xs text-ink-muted-48">Tracker status</p>
            <StatusBadge status={volunteer.tracker_status === 'completed' ? 'verified' : volunteer.tracker_status} />
          </div>

          <div>
            <p className="text-xs text-ink-muted-48">Check-in / Check-out</p>
            <p>{fmtTime(volunteer.check_in_time)} → {fmtTime(volunteer.check_out_time)}</p>
          </div>

          <div>
            <p className="text-xs text-ink-muted-48">Hours (verified / calculated)</p>
            <p>{volunteer.verified_hours} / {volunteer.calculated_hours}</p>
          </div>

          {permissions?.can_view_pii && (
            <>
              <div>
                <p className="text-xs text-ink-muted-48">Phone</p>
                <p>{volunteer.phone_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted-48">Emergency contact</p>
                <p>{volunteer.emergency_contact || '—'}</p>
              </div>
            </>
          )}

          {!permissions?.can_view_pii && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-muted-80">
              Contact details are visible only to the event organizer and LGU admins.
            </p>
          )}

          {mapsUrl && (
            <div>
              <p className="text-xs text-ink-muted-48">Check-in location</p>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                View on map
              </a>
            </div>
          )}

          {volunteer.selfie_url && (
            <div>
              <p className="mb-2 text-xs text-ink-muted-48">Selfie check-in</p>
              <img src={volunteer.selfie_url} alt="Volunteer selfie" className="max-h-48 rounded-lg object-cover" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
