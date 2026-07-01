import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { PassiveSession } from '../../types/worker';

function formatDuration(started: string, ended?: string | null) {
  const start = new Date(started).getTime();
  const end = ended ? new Date(ended).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function WorkerShiftsPage() {
  const [sessions, setSessions] = useState<PassiveSession[]>([]);

  const load = useCallback(() => {
    api<PassiveSession[]>('/api/passive/sessions?limit=50').then(setSessions).catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="page-content">
        <h2 className="text-lg font-semibold text-ink">Shift history</h2>
        <p className="mt-1 text-sm text-ink-muted-48">All Passive Mode sessions from your mobile app.</p>

        <div className="staff-team-card mt-6 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-ink-muted-48">
                <th className="px-5 py-3">Started</th>
                <th className="px-5 py-3">Ended</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Chunks</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-hairline/60">
                  <td className="px-5 py-3">{new Date(s.started_at).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    {s.ended_at ? new Date(s.ended_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3">{formatDuration(s.started_at, s.ended_at)}</td>
                  <td className="px-5 py-3">{s.total_chunks}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`staff-role-badge ${
                        s.route_status === 'active'
                          ? 'staff-role-badge-field'
                          : 'staff-role-badge-other'
                      }`}
                    >
                      {s.route_status}
                    </span>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-muted-48">
                    No shifts recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
