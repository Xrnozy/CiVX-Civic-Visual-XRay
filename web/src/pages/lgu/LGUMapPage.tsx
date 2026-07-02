import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CommunityMapShell } from '../../components/map/CommunityMapShell';
import { DEFAULT_MAP_ZOOM } from '../../shared/constants';

export default function LGUMapPage() {
  const [searchParams] = useSearchParams();

  const center = useMemo(() => {
    const lat = parseFloat(searchParams.get('lat') ?? '');
    const lng = parseFloat(searchParams.get('lng') ?? '');
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    return undefined;
  }, [searchParams]);

  return (
    <CommunityMapShell
      lguMarkers
      lguMode
      center={center}
      zoom={center ? 16 : DEFAULT_MAP_ZOOM}
      loginNext="/lgu/map"
      subNav={{
        title: 'Operational Map',
        lead: 'Incidents and approved cleanup events across your jurisdiction',
        actionTo: '/lgu/queue',
        actionLabel: 'Review Queue',
      }}
    />
  );
}
