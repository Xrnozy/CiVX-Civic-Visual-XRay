import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { SubNavFrosted } from '../components/ui/SubNavFrosted';
import { CivicMap } from '../components/map/CivicMap';
import { Footer } from '../components/ui/Footer';
import { ButtonPrimary } from '../components/ui/Buttons';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ISSUE_CATEGORIES, INCIDENT_STATUSES } from '../shared/constants';
import {
  CommunityIncidentDrawer,
  CommunityIncidentDetail,
  CommunityIncidentReport,
} from '../components/map/CommunityIncidentDrawer';
import { CommunityEventDrawer } from '../components/map/CommunityEventDrawer';
import type { OrganizerCleanupEvent } from '../components/organizer/OrganizerEventDetailCard';
import { StatusBadge } from '../components/lgu/attendance/StatusBadge';
import type { AttendanceStatus } from '../types/attendance';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';

interface CommunityMapMarker {
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

export default function MapPage() {
  const navigate = useNavigate();
  const { user, ready: authReady } = useAuth();
  const { profile, ready: profileReady } = useProfile();
  const [markers, setMarkers] = useState<CommunityMapMarker[]>([]);
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

  useEffect(() => {
    const params = new URLSearchParams();
    if (issueType) params.set('issue_type', issueType);
    if (status) params.set('status', status);
    api<{
      incidents: CommunityMapMarker[];
      cleanup_events: Array<{
        id: string;
        latitude: number;
        longitude: number;
        title: string;
        barangay?: string;
        scheduled_start?: string;
      }>;
    }>(`/api/maps/markers?${params}`)
      .then((d) => {
        setMarkers([
          ...d.incidents.map((i) => ({ ...i, type: 'incident' as const })),
          ...d.cleanup_events.map((e) => ({ ...e, type: 'cleanup' as const })),
        ]);
      })
      .catch(() => setMarkers([]));
  }, [issueType, status]);

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
    if (!marker || marker.type !== 'cleanup' || !user) {
      return;
    }

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
  }

  const handleJoinEvent = useCallback(async () => {
    if (!selectedMarker || selectedMarker.type !== 'cleanup') return;
    if (!user) {
      navigate('/login?next=/map');
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
  }, [selectedMarker, user, profileReady, profile, volunteerStatus?.registered, drawerEvent?.barangay, navigate]);

  function volunteerFooter() {
    if (!authReady) {
      return <p className="text-sm text-ink-muted-48">Checking sign-in status…</p>;
    }

    if (!user) {
      return (
        <ButtonPrimary type="button" className="w-full justify-center" onClick={() => navigate('/login?next=/map')}>
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
          {joinLoading ? 'Joining…' : 'Join Event'}
        </ButtonPrimary>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <GlobalNav />
      <SubNavFrosted
        title="Community Map"
        lead="Public issues and approved cleanup events near you"
        action={<Link to="/report"><ButtonPrimary>Report Issue</ButtonPrimary></Link>}
      />
      <div className="page-content">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <select className="filter-select" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
            <option value="">All issue types</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <span className="text-sm text-ink-muted-48">{markers.length} markers</span>
        </div>
        <div className="map-shell relative">
          <div className="min-h-[70vh]">
            <CivicMap
              markers={markers}
              selectedMarkerId={selectedMarker?.id ?? null}
              onMarkerSelect={(marker) => {
                setSelectedMarker(marker);
                setExpanded(false);
                setJoinError('');
              }}
              onMapBackgroundClick={closePreview}
              onPreviewExpand={(markerId) => {
                const marker = markers.find((item) => item.id === markerId);
                if (marker) {
                  setSelectedMarker(marker);
                  setExpanded(true);
                }
              }}
            />
          </div>
          {expanded && selectedMarker?.type === 'incident' ? (
            <>
              <button
                type="button"
                aria-label="Close incident details"
                className="absolute inset-0 z-20 bg-black/40"
                onClick={() => setExpanded(false)}
              />
              <div className="absolute inset-y-0 left-0 z-30 flex h-full w-full max-w-[min(100%,420px)] sm:w-[min(42%,480px)] sm:min-w-[320px]">
                <CommunityIncidentDrawer
                  incident={drawerIncident}
                  reports={drawerReports}
                  loading={loadingIncidentDetails}
                  onClose={() => setExpanded(false)}
                  overlay
                />
              </div>
            </>
          ) : null}
          {expanded && selectedMarker?.type === 'cleanup' ? (
            <>
              <button
                type="button"
                aria-label="Close cleanup event details"
                className="absolute inset-0 z-20 bg-black/40"
                onClick={() => setExpanded(false)}
              />
              <div className="absolute inset-y-0 left-0 z-30 flex h-full w-full max-w-[min(100%,420px)] sm:w-[min(42%,480px)] sm:min-w-[320px]">
                <CommunityEventDrawer
                  event={drawerEvent}
                  organizerName={drawerEvent?.organizer_name || 'Community organizer'}
                  goingCount={drawerEvent?.going_count ?? 0}
                  loading={loadingEventDetails}
                  onClose={() => setExpanded(false)}
                  overlay
                  volunteerFooter={volunteerFooter()}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
      <Footer />
    </div>
  );
}
