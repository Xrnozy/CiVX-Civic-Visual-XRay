import { useEffect, useState } from 'react';
import { ButtonPrimary } from '../../components/ui/Buttons';
import { api } from '../../lib/api';

interface Event {
  id: string;
  title: string;
  approval_status: string;
  barangay?: string;
}

export default function LGUCleanupPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const load = () => api<Event[]>('/api/cleanup-events').then(setEvents).catch(() => setEvents([]));
  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="text-[34px] font-semibold">Cleanup Approval</h1>
      <div className="mt-6 space-y-4">
        {events.map((e) => (
          <div key={e.id} className="store-utility-card flex justify-between">
            <div>
              <p className="font-semibold">{e.title}</p>
              <p className="text-sm">{e.barangay} · {e.approval_status}</p>
            </div>
            {e.approval_status === 'pending' && (
              <ButtonPrimary onClick={() => api(`/api/cleanup-events/${e.id}/approve`, { method: 'POST' }).then(load)}>Approve</ButtonPrimary>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
