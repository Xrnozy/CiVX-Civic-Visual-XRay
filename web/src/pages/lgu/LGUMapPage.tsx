import { useEffect, useState } from 'react';
import { CivicMap } from '../../components/map/CivicMap';
import { api } from '../../lib/api';

export default function LGUMapPage() {
  const [markers, setMarkers] = useState<Array<{ id: string; latitude: number; longitude: number; primary_issue_type?: string; type: 'incident' | 'cleanup' }>>([]);

  useEffect(() => {
    api<{ incidents: Array<{ id: string; latitude: number; longitude: number; primary_issue_type: string }> }>('/api/maps/markers?lgu=true')
      .then((d) => setMarkers(d.incidents.map((i) => ({ ...i, type: 'incident' as const }))))
      .catch(() => setMarkers([]));
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-[34px] font-semibold">LGU Operational Map</h1>
      <CivicMap markers={markers} lguMode />
    </div>
  );
}
