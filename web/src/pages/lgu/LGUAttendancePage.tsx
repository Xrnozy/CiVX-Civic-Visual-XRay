import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import type { AttendanceEventOption, EventRoster, VolunteerAttendance } from '../../types/attendance';
import { EventSelector } from '../../components/lgu/attendance/EventSelector';
import { AttendanceSummaryBar } from '../../components/lgu/attendance/AttendanceSummaryBar';
import { AttendanceTable } from '../../components/lgu/attendance/AttendanceTable';
import { VolunteerDetailDrawer } from '../../components/lgu/attendance/VolunteerDetailDrawer';

const POLL_MS = 10000;

export default function LGUAttendancePage() {
  const { user, ready } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<AttendanceEventOption[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('event_id') || '');
  const [roster, setRoster] = useState<EventRoster | null>(null);
  const [detail, setDetail] = useState<VolunteerAttendance | null>(null);

  const loadEvents = useCallback(() => {
    api<AttendanceEventOption[]>('/api/attendance/events?approved_only=true')
      .then((list) => {
        setEvents(list);
        if (!selectedId && list.length > 0) {
          setSelectedId(list[0].id);
        }
      })
      .catch(() => setEvents([]));
  }, [selectedId]);

  const loadRoster = useCallback(() => {
    if (!selectedId) {
      setRoster(null);
      return;
    }
    api<EventRoster>(`/api/attendance/events/${selectedId}`)
      .then(setRoster)
      .catch(() => setRoster(null));
  }, [selectedId]);

  useEffect(() => {
    if (!ready || !user) return;
    loadEvents();
  }, [ready, user, loadEvents]);

  useEffect(() => {
    if (!selectedId) return;
    setSearchParams({ event_id: selectedId }, { replace: true });
    loadRoster();
    const id = setInterval(loadRoster, POLL_MS);
    return () => clearInterval(id);
  }, [selectedId, loadRoster, setSearchParams]);

  const handleEventChange = (id: string) => {
    setSelectedId(id);
    setDetail(null);
  };

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[34px] font-semibold">Attendance Monitor</h1>
          <p className="mt-1 text-sm text-ink-muted-80">
            Tracker-based attendance — updates automatically from volunteer GPS/QR check-in and check-out.
            Refreshes every {POLL_MS / 1000}s.
          </p>
        </div>
        <EventSelector events={events} selectedId={selectedId} onChange={handleEventChange} />
      </div>

      {roster?.event && (
        <p className="mt-4 text-sm text-ink-muted-80">
          {roster.event.title}
          {roster.event.barangay ? ` · ${roster.event.barangay}` : ''}
          {' · '}
          {new Date(roster.event.scheduled_start).toLocaleString()}
          {roster.summary.checked_in_percent > 0 && (
            <span className="ml-2 text-ink-muted-48">
              ({roster.summary.checked_in_percent}% checked in or completed)
            </span>
          )}
        </p>
      )}

      <div className="mt-6">
        <AttendanceSummaryBar summary={roster?.summary ?? null} />
      </div>

      <div className="mt-8">
        <AttendanceTable mode="lgu" roster={roster} onSelect={setDetail} />
      </div>

      <VolunteerDetailDrawer
        volunteer={detail}
        permissions={roster?.permissions ?? null}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
