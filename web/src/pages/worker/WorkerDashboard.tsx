import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import type { PassiveDetection, PassiveSession, PassiveWorkerSummary } from '../../types/worker';

function formatDuration(started: string, ended?: string | null) {
  const start = new Date(started).getTime();
  const end = ended ? new Date(ended).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatIssueType(type: string) {
  return type.replace(/_/g, ' ');
}

export default function WorkerDashboard() {
  const [summary, setSummary] = useState<PassiveWorkerSummary | null>(null);
  const [sessions, setSessions] = useState<PassiveSession[]>([]);
  const [detections, setDetections] = useState<PassiveDetection[]>([]);

  const load = useCallback(() => {
    api<PassiveWorkerSummary>('/api/passive/me/summary').then(setSummary).catch(() => setSummary(null));
    api<PassiveSession[]>('/api/passive/sessions?limit=5').then(setSessions).catch(() => setSessions([]));
    api<PassiveDetection[]>('/api/passive/detections/recent?limit=8')
      .then(setDetections)
      .catch(() => setDetections([]));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="page-content">
        <div className="grid gap-6 md:grid-cols-4">
          <StatCard label="Total shifts" value={summary?.total_sessions ?? '—'} />
          <StatCard label="Video chunks" value={summary?.total_chunks ?? '—'} />
          <StatCard label="Issues detected" value={summary?.total_detections ?? '—'} />
          <StatCard
            label="Active shift"
            value={summary?.active_session_id ? 'Recording' : 'None'}
          />
        </div>

        <div className="store-utility-card mt-8 border-primary/20 bg-gradient-to-br from-canvas to-canvas-parchment">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Passive Mode</p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Record your route on mobile</h2>
              <p className="mt-2 max-w-xl text-sm text-ink-muted-80">
                Route recording runs in the <strong>CiVX mobile app</strong>. Open <strong>Passive Mode</strong> while
                you work — video chunks upload automatically and CiVX detects issues along your path.
              </p>
            </div>
            <div className="shrink-0 rounded-[18px] border border-hairline bg-canvas px-6 py-4 text-center">
              <p className="text-3xl" aria-hidden>
                📱
              </p>
              <p className="mt-2 text-sm font-medium text-ink">CiVX Mobile</p>
              <p className="text-xs text-ink-muted-48">Passive Mode</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">Recent shifts</h2>
            <div className="staff-team-card mt-4">
              {sessions.length === 0 ? (
                <p className="p-6 text-center text-sm text-ink-muted-48">
                  No shifts yet. Start Passive Mode on the mobile app.
                </p>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="staff-team-row !py-4">
                    <div>
                      <p className="font-medium text-ink">
                        {new Date(s.started_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-ink-muted-48">
                        {formatDuration(s.started_at, s.ended_at)} · {s.total_chunks} chunks
                      </p>
                    </div>
                    <span
                      className={`staff-role-badge ${
                        s.route_status === 'active'
                          ? 'staff-role-badge-field'
                          : 'staff-role-badge-other'
                      }`}
                    >
                      {s.route_status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink">Recent detections</h2>
            <div className="staff-team-card mt-4">
              {detections.length === 0 ? (
                <p className="p-6 text-center text-sm text-ink-muted-48">
                  Issues from your routes will appear here after chunks are processed.
                </p>
              ) : (
                detections.map((d) => (
                  <div key={d.id} className="staff-team-row !py-4">
                    <div>
                      <p className="font-medium capitalize text-ink">{formatIssueType(d.detected_issue_type)}</p>
                      <p className="text-sm text-ink-muted-48">
                        {new Date(d.created_at).toLocaleString()} ·{' '}
                        {Math.round(d.confidence * 100)}% confidence
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
