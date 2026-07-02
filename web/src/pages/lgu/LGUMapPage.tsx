import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CivicMap } from '../../components/map/CivicMap';
import { DEFAULT_MAP_ZOOM } from '../../shared/constants';
import { api } from '../../lib/api';

export default function LGUMapPage() {
  const [searchParams] = useSearchParams();
  const [markers, setMarkers] = useState<Array<{ id: string; latitude: number; longitude: number; primary_issue_type?: string; type: 'incident' | 'cleanup' }>>([]);

  const center = useMemo(() => {
    const lat = parseFloat(searchParams.get('lat') ?? '');
    const lng = parseFloat(searchParams.get('lng') ?? '');
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    return undefined;
  }, [searchParams]);

  useEffect(() => {
    api<{ incidents: Array<{ id: string; latitude: number; longitude: number; primary_issue_type: string }> }>('/api/maps/markers?lgu=true')
      .then((d) => setMarkers(d.incidents.map((i) => ({ ...i, type: 'incident' as const }))))
      .catch(() => setMarkers([]));
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-[34px] font-semibold">LGU Operational Map</h1>
      <CivicMap markers={markers} lguMode center={center} zoom={center ? 16 : DEFAULT_MAP_ZOOM} />
    </div>
  );
}
