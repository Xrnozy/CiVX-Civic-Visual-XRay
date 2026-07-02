import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { CommunityMapShell } from '../components/map/CommunityMapShell';
import { useProfile } from '../hooks/useProfile';
import { isLguPortalRole } from '../lib/auth';
import { DEFAULT_MAP_ZOOM } from '../shared/constants';

export default function MapPage() {
  const [searchParams] = useSearchParams();
  const { profile, ready } = useProfile();

  const lguMode = ready && isLguPortalRole(profile?.role);

  const center = useMemo(() => {
    const lat = parseFloat(searchParams.get('lat') ?? '');
    const lng = parseFloat(searchParams.get('lng') ?? '');
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    return undefined;
  }, [searchParams]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <GlobalNav />
      <CommunityMapShell
        lguMarkers={lguMode}
        lguMode={lguMode}
        center={center}
        zoom={center ? 16 : lguMode ? DEFAULT_MAP_ZOOM : undefined}
        loginNext="/map"
        subNav={
          lguMode
            ? {
                title: 'Operational Map',
                lead: 'Incidents, cleanup events, and EcoQuest tasks across your jurisdiction',
                actionTo: '/lgu/queue',
                actionLabel: 'Review Queue',
              }
            : undefined
        }
      />
    </div>
  );
}
