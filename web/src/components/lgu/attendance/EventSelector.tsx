import type { AttendanceEventOption } from '../../../types/attendance';

interface Props {
  events: AttendanceEventOption[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function EventSelector({ events, selectedId, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor="attendance-event" className="text-sm font-medium text-ink-muted-80">
        Cleanup event
      </label>
      <select
        id="attendance-event"
        className="store-utility-card min-w-[280px] flex-1 border-0 py-2 text-sm"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
      >
        {events.length === 0 && <option value="">No approved events</option>}
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.title}
            {ev.barangay ? ` · ${ev.barangay}` : ''}
            {` (${ev.total_volunteers} volunteers)`}
          </option>
        ))}
      </select>
    </div>
  );
}
