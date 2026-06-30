import { useCallback, useEffect, useState } from 'react';
import { ButtonPrimary } from '../../components/ui/Buttons';
import { api } from '../../lib/api';
import { useDashboardSocket } from '../../hooks/useDashboardSocket';

interface Incident {
  id: string;
  primary_issue_type: string;
  status: string;
  triage_priority?: number;
  severity_score?: number;
  report_count?: number;
  created_at: string;
}

export default function LGUQueuePage() {
  const [queue, setQueue] = useState<Incident[]>([]);

  const load = useCallback(() => {
    api<Incident[]>('/api/incidents').then(setQueue).catch(() => setQueue([]));
  }, []);

  useEffect(() => { load(); }, [load]);
  useDashboardSocket((data) => setQueue(data as Incident[]));

  async function verify(id: string) {
    await api(`/api/incidents/${id}/verify`, { method: 'POST' });
    load();
  }

  async function assign(id: string) {
    const dept = prompt('Department ID (from seed data):');
    if (!dept) return;
    await api(`/api/incidents/${id}/assign?department_id=${encodeURIComponent(dept)}`, { method: 'POST' });
    load();
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="text-[34px] font-semibold">Incident Queue</h1>
      <div className="mt-6 space-y-4">
        {queue.map((inc) => (
          <div key={inc.id} className="store-utility-card flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{inc.primary_issue_type.replace(/_/g, ' ')}</p>
              <p className="text-sm text-ink-muted-48">
                Priority {inc.triage_priority} · Severity {inc.severity_score} · {inc.report_count} reports · {inc.status}
              </p>
            </div>
            <div className="flex gap-2">
              <ButtonPrimary onClick={() => verify(inc.id)}>Verify</ButtonPrimary>
              <ButtonPrimary onClick={() => assign(inc.id)}>Assign</ButtonPrimary>
              <ButtonPrimary onClick={() => api(`/api/incidents/${inc.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) }).then(load)}>Resolve</ButtonPrimary>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
