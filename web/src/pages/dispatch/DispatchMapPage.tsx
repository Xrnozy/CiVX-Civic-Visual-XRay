import { useEffect, useState } from 'react';
import { CivicMap } from '../../components/map/CivicMap';
import { api } from '../../lib/api';

export default function DispatchMapPage() {
  const [markers, setMarkers] = useState<
    Array<{ id: string; latitude: number; longitude: number; primary_issue_type: string; type: 'incident' }>
  >([]);

  useEffect(() => {
    api<
      Array<{
        id: string;
        incidents?: { id: string; latitude: number; longitude: number; primary_issue_type: string };
      }>
    >('/api/dispatch/cases')
      .then((rows) =>
        setMarkers(
          rows
            .filter((r) => r.incidents?.latitude != null)
            .map((r) => ({
              id: r.incidents!.id,
              latitude: r.incidents!.latitude,
              longitude: r.incidents!.longitude,
              primary_issue_type: r.incidents!.primary_issue_type,
              type: 'incident' as const,
            })),
        ),
      )
      .catch(() => setMarkers([]));
  }, []);

  return (
    <div className="ui-card p-0 overflow-hidden">
      <div className="px-5 py-4">
        <p className="ui-card-title">Assigned cases map</p>
      </div>
      <div className="h-[60vh]">
        <CivicMap markers={markers} heightClass="h-full" hideMapChrome flush />
      </div>
    </div>
  );
}
