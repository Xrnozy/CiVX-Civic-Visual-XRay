import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CivicMap } from './CivicMap';
import {
  CommunityIncidentDetail,
  CommunityIncidentDrawer,
  CommunityIncidentReport,
} from './CommunityIncidentDrawer';
import { CommunityEventDrawer } from './CommunityEventDrawer';
import { type MapLayer } from './MapFilterBar';
import { type MapSubNavConfig } from './MapSubNav';
import { MapTopBar } from './MapTopBar';
import { ButtonPrimary } from '../ui/Buttons';
import { ImageGalleryOverlay } from '../ui/ImageGalleryOverlay';
import { SlideInPanel } from '../motion/SlideInPanel';
import type { OrganizerCleanupEvent } from '../organizer/OrganizerEventDetailCard';
import { StatusBadge } from '../lgu/attendance/StatusBadge';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import type { AttendanceStatus } from '../../types/attendance';

export interface CommunityMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  primary_issue_type?: string;
  title?: string;
  type: 'incident' | 'cleanup';
  status?: string;
  severity_score?: number;
  report_count?: number;
  source?: string;
  submitter_type?: string;
  created_at?: string;
  preview_photo_url?: string;
  preview_description?: string;
  preview_ai_suggested_type?: string;
  preview_ai_confidence?: number;
  preview_created_at?: string;
  barangay?: string;
  scheduled_start?: string;
}

interface IncidentDetailsBundle {
  incident: CommunityIncidentDetail;
  reports: CommunityIncidentReport[];
}

interface PublicCleanupEvent extends OrganizerCleanupEvent {
  going_count?: number;
  organizer_name?: string;
}

interface VolunteerEventStatus {
  registered: boolean;
  status?: AttendanceStatus;
}

const VOLUNTEER_STATUS_LABELS: Record<AttendanceStatus, string> = {
  registered: "You're registered",
  'checked-in': "You're checked in",
  'checked-out': "You're checked out",
  verified: 'Attendance verified',
  rejected: 'Registration rejected',
};

interface Props {
  lguMarkers?: boolean;
  lguMode?: boolean;
  zoom?: number;
  center?: { lat: number; lng: number };
  loginNext?: string;
  subNav?: MapSubNavConfig;
}

export function CommunityMapShell({
  lguMarkers = false,
  lguMode = false,
  zoom = 12,
  center,
  loginNext = '/map',
  subNav,
}: Props) {
  const navigate = useNavigate();
  const { user, ready: authReady } = useAuth();
  const { profile, ready: profileReady } = useProfile();
  const [incidentMarkers, setIncidentMarkers] = useState<CommunityMapMarker[]>([]);
  const [eventMarkers, setEventMarkers] = useState<CommunityMapMarker[]>([]);
  const [mapLayer, setMapLayer] = useState<MapLayer>('issues');
  const [issueType, setIssueType] = useState('');
  const [status, setStatus] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<CommunityMapMarker | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loadingIncidentDetails, setLoadingIncidentDetails] = useState(false);
  const [loadingEventDetails, setLoadingEventDetails] = useState(false);
  const [incidentDetailsCache, setIncidentDetailsCache] = useState<Record<string, IncidentDetailsBundle>>({});
  const [eventDetailsCache, setEventDetailsCache] = useState<Record<string, PublicCleanupEvent>>({});
  const [volunteerStatusCache, setVolunteerStatusCache] = useState<Record<string, VolunteerEventStatus>>({});
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [gallery, setGallery] = useState<{ images: string[]; index: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (lguMarkers) params.set('lgu', 'true');
    if (issueType) params.set('issue_type', issueType);
    if (status) params.set('status', status);
    const query = params.toString();

    api<{
      incidents: CommunityMapMarker[];
      cleanup_events?: Array<{
        id: string;
        latitude: number;
        longitude: number;
        title: string;
        barangay?: string;
        scheduled_start?: string;
        preview_photo_url?: string;
      }>;
    }>(`/api/maps/markers${query ? `?${query}` : ''}`)
      .then((data) => {
        setIncidentMarkers(data.incidents.map((incident) => ({ ...incident, type: 'incident' as const })));
        setEventMarkers((data.cleanup_events ?? []).map((event) => ({ ...event, type: 'cleanup' as const })));
      })
      .catch(() => {
        setIncidentMarkers([]);
        setEventMarkers([]);
      });
  }, [issueType, status, lguMarkers]);

  const markers = useMemo(() => {
    const baseMarkers =
      mapLayer === 'issues'
        ? incidentMarkers
        : mapLayer === 'events'
          ? eventMarkers
          : [...incidentMarkers, ...eventMarkers];

    return baseMarkers.map((marker) => {
      if (marker.type !== 'cleanup') return marker;
      const bannerUrl = eventDetailsCache[marker.id]?.banner_url?.trim();
      if (!bannerUrl || marker.preview_photo_url === bannerUrl) return marker;
      return { ...marker, preview_photo_url: bannerUrl };
    });
  }, [eventDetailsCache, eventMarkers, incidentMarkers, mapLayer]);

  useEffect(() => {
    const marker = selectedMarker;
    if (!marker || marker.type !== 'incident') return;

    let cancelled = false;
    setLoadingIncidentDetails(true);
    Promise.all([
      api<CommunityIncidentDetail>(`/api/incidents/${marker.id}`),
      api<CommunityIncidentReport[]>(`/api/incidents/${marker.id}/reports`),
    ])
      .then(([incident, reports]) => {
        if (cancelled) return;
        setIncidentDetailsCache((prev) => ({
          ...prev,
          [marker.id]: { incident, reports },
        }));
      })
      .finally(() => {
        if (!cancelled) setLoadingIncidentDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMarker?.id, selectedMarker?.type]);

  useEffect(() => {
    const marker = selectedMarker;
    if (!marker || marker.type !== 'cleanup') return;

    let cancelled = false;
    setLoadingEventDetails(true);
    setJoinError('');
    api<PublicCleanupEvent>(`/api/cleanup-events/${marker.id}`)
      .then((event) => {
        if (cancelled) return;
        setEventDetailsCache((prev) => ({ ...prev, [marker.id]: event }));
      })
      .catch(() => {
        if (!cancelled) {
          setEventDetailsCache((prev) => {
            const next = { ...prev };
            delete next[marker.id];
            return next;
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEventDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMarker?.id, selectedMarker?.type]);

  useEffect(() => {
    const marker = selectedMarker;
    if (!marker || marker.type !== 'cleanup' || !user) return;

    let cancelled = false;
    api<VolunteerEventStatus>(`/api/volunteers/events/${marker.id}/me`)
      .then((statusResult) => {
        if (cancelled) return;
        setVolunteerStatusCache((prev) => ({ ...prev, [marker.id]: statusResult }));
      })
      .catch(() => {
        if (!cancelled) {
          setVolunteerStatusCache((prev) => ({ ...prev, [marker.id]: { registered: false } }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMarker?.id, selectedMarker?.type, user?.uid]);

  useEffect(() => {
    setGallery(null);
  }, [selectedMarker?.id]);

  const activeIncidentDetails =
    selectedMarker && selectedMarker.type === 'incident' ? incidentDetailsCache[selectedMarker.id] : undefined;
  const drawerIncident = activeIncidentDetails?.incident ?? null;
  const drawerReports = activeIncidentDetails?.reports ?? [];

  const activeEventDetails =
    selectedMarker && selectedMarker.type === 'cleanup' ? eventDetailsCache[selectedMarker.id] : undefined;
  const drawerEvent = activeEventDetails ?? null;
  const volunteerStatus =
    selectedMarker?.type === 'cleanup' ? volunteerStatusCache[selectedMarker.id] : undefined;

  function closePreview() {
    setSelectedMarker(null);
    setExpanded(false);
    setJoinError('');
    setGallery(null);
  }

  const handleJoinEvent = useCallback(async () => {
    if (!selectedMarker || selectedMarker.type !== 'cleanup') return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    if (!profileReady || !profile) return;
    if (volunteerStatus?.registered) return;

    setJoinLoading(true);
    setJoinError('');
    try {
      await api(`/api/volunteers/events/${selectedMarker.id}/register`, {
        method: 'POST',
        body: JSON.stringify({
          full_name: profile.full_name,
          phone_number: profile.phone_number || undefined,
          barangay: profile.barangay || drawerEvent?.barangay || undefined,
          safety_agreement: true,
        }),
      });
      setVolunteerStatusCache((prev) => ({
        ...prev,
        [selectedMarker.id]: { registered: true, status: 'registered' },
      }));
      setEventDetailsCache((prev) => {
        const current = prev[selectedMarker.id];
        if (!current) return prev;
        return {
          ...prev,
          [selectedMarker.id]: {
            ...current,
            going_count: (current.going_count ?? 0) + 1,
          },
        };
      });
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join this event');
    } finally {
      setJoinLoading(false);
    }
  }, [
    selectedMarker,
    user,
    profileReady,
    profile,
    volunteerStatus?.registered,
    drawerEvent?.barangay,
    navigate,
    loginNext,
  ]);

  function volunteerFooter() {
    if (!authReady) {
      return <p className="text-sm text-ink-muted-48">Checking sign-in status...</p>;
    }

    if (!user) {
      return (
        <ButtonPrimary
          type="button"
          className="w-full justify-center"
          onClick={() => navigate(`/login?next=${encodeURIComponent(loginNext)}`)}
        >
          Join Event
        </ButtonPrimary>
      );
    }

    if (volunteerStatus?.registered && volunteerStatus.status) {
      return (
        <div className="rounded-[11px] border border-hairline bg-canvas-parchment px-4 py-3 text-center">
          <p className="text-sm font-medium text-ink">{VOLUNTEER_STATUS_LABELS[volunteerStatus.status]}</p>
          <div className="mt-2 flex justify-center">
            <StatusBadge status={volunteerStatus.status} />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {joinError ? <p className="text-sm text-red-600">{joinError}</p> : null}
        <ButtonPrimary
          type="button"
          className="w-full justify-center"
          disabled={joinLoading || !profileReady}
          onClick={() => void handleJoinEvent()}
        >
          {joinLoading ? 'Joining...' : 'Join Event'}
        </ButtonPrimary>
      </div>
    );
  }

  return (
    <div className="page-content-map min-h-0 flex-1">
      <div className="map-shell-immersive relative flex h-full min-h-0 flex-1 flex-col">
        <MapTopBar
          subNav={subNav}
          mapLayer={mapLayer}
          onMapLayerChange={setMapLayer}
          issueType={issueType}
          onIssueTypeChange={setIssueType}
          status={status}
          onStatusChange={setStatus}
          incidentCount={incidentMarkers.length}
          eventCount={eventMarkers.length}
        />
        <div className="min-h-0 flex-1">
          <CivicMap
            markers={markers}
            lguMode={lguMode}
            center={center}
            zoom={zoom}
            heightClass="h-full"
            hideMapChrome
            flush
            selectedMarkerId={selectedMarker?.id ?? null}
            onMarkerSelect={(marker) => {
              setSelectedMarker(marker);
              setExpanded(false);
              setJoinError('');
              setGallery(null);
            }}
            onMapBackgroundClick={closePreview}
            onPreviewExpand={(markerId) => {
              const marker = markers.find((item) => item.id === markerId);
              if (marker) {
                setSelectedMarker(marker);
                setExpanded(true);
                setJoinError('');
                setGallery(null);
              }
            }}
          />
        </div>

        {gallery ? (
          <ImageGalleryOverlay
            contained
            className="absolute inset-0 z-40"
            images={gallery.images}
            index={gallery.index}
            onClose={() => setGallery(null)}
            onChange={(index) => setGallery((current) => (current ? { ...current, index } : null))}
          />
        ) : null}

        {expanded && selectedMarker?.type === 'incident' ? (
          <>
            <button
              type="button"
              aria-label="Close incident details"
              className="absolute inset-0 z-20 bg-black/40"
              onClick={closePreview}
            />
            <SlideInPanel className="map-drawer-panel">
              <CommunityIncidentDrawer
                incident={drawerIncident}
                reports={drawerReports}
                loading={loadingIncidentDetails}
                onClose={closePreview}
                onOpenGallery={(images, index) => setGallery({ images, index })}
                overlay
              />
            </SlideInPanel>
          </>
        ) : null}

        {expanded && selectedMarker?.type === 'cleanup' ? (
          <>
            <button
              type="button"
              aria-label="Close cleanup event details"
              className="absolute inset-0 z-20 bg-black/40"
              onClick={closePreview}
            />
            <SlideInPanel className="map-drawer-panel">
              <CommunityEventDrawer
                event={drawerEvent}
                organizerName={drawerEvent?.organizer_name || 'Community organizer'}
                goingCount={drawerEvent?.going_count ?? 0}
                loading={loadingEventDetails}
                onClose={closePreview}
                overlay
                volunteerFooter={volunteerFooter()}
              />
            </SlideInPanel>
          </>
        ) : null}
      </div>
    </div>
  );
}
