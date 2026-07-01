import { useEffect, useState } from 'react';
import { GlobalNav } from '../components/ui/GlobalNav';
import { SubNavFrosted } from '../components/ui/SubNavFrosted';
import { Footer } from '../components/ui/Footer';
import { api } from '../lib/api';

interface Incident {
  id: string;
  primary_issue_type: string;
  barangay?: string;
  status: string;
  resolved_at?: string;
}

export default function TransparencyPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  useEffect(() => {
    api<Incident[]>('/api/incidents/public?status=resolved').then(setIncidents).catch(() => setIncidents([]));
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <GlobalNav />
      <SubNavFrosted title="Public Transparency" lead="Resolved community issues — sanitized for public view" />
      <div className="page-content">
        <div className="store-utility-card overflow-hidden p-0">
          {incidents.length === 0 ? (
            <p className="p-12 text-center text-ink-muted-48">No resolved incidents yet.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {incidents.map((i) => (
                <li key={i.id} className="flex items-center justify-between px-6 py-5">
                  <div>
                    <span className="font-semibold text-ink capitalize">{i.primary_issue_type.replace(/_/g, ' ')}</span>
                    <span className="ml-3 text-sm text-ink-muted-48">{i.barangay || 'Unknown area'}</span>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Resolved</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
