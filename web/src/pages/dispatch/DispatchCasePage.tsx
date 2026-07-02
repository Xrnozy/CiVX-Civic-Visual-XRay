import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CivicMap } from '../../components/map/CivicMap';
import { api } from '../../lib/api';

const STATUSES = [
  { id: 'assigned', label: 'Assigned' },
  { id: 'on_the_way', label: 'On the way' },
  { id: 'checking_site', label: 'Checking site' },
  { id: 'verified', label: 'Verified' },
  { id: 'needs_action', label: 'Needs action' },
  { id: 'resolved', label: 'Resolved' },
];

interface CaseBundle {
  assignment: {
    id: string;
    dispatch_status: string;
    checker_notes?: string;
    before_photo_url?: string;
    after_photo_url?: string;
  };
  incident: {
    id: string;
    primary_issue_type: string;
    status: string;
    latitude: number;
    longitude: number;
    barangay?: string;
    source?: string;
  };
  reports: Array<{
    id: string;
    description?: string;
    photo_url?: string;
    issue_type: string;
    created_at: string;
  }>;
  department?: { name: string; code: string };
  activity: Array<{ id: string; dispatch_status?: string; notes?: string; created_at: string; photo_url?: string }>;
  recommendation?: { dispatch_label?: string };
}

export default function DispatchCasePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [data, setData] = useState<CaseBundle | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function load() {
    if (!assignmentId) return;
    api<CaseBundle>(`/api/dispatch/cases/${assignmentId}`)
      .then((d) => {
        setData(d);
        setNotes(d.assignment.checker_notes || '');
      })
      .catch(() => setData(null));
  }

  useEffect(load, [assignmentId]);

  async function updateStatus(dispatch_status: string) {
    if (!assignmentId) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('dispatch_status', dispatch_status);
      if (notes.trim()) form.append('notes', notes.trim());
      await api(`/api/dispatch/cases/${assignmentId}/status`, { method: 'PATCH', body: form });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(photo_type: 'before' | 'after', file: File) {
    if (!assignmentId) return;
    setBusy(true);
    const form = new FormData();
    form.append('photo_type', photo_type);
    form.append('photo', file);
    try {
      await api(`/api/dispatch/cases/${assignmentId}/photos`, { method: 'POST', body: form });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <div className="ui-card text-sm text-ink-muted-48">Loading case…</div>;
  }

  const { assignment, incident, reports, department, activity, recommendation } = data;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${incident.latitude},${incident.longitude}`;

  return (
    <div className="space-y-4">
      <div className="ui-card">
        <p className="ui-card-title">Submitted report</p>
        <h2 className="mt-1 text-xl font-semibold capitalize">{incident.primary_issue_type.replace(/_/g, ' ')}</h2>
        <p className="text-sm text-ink-muted-48">
          {incident.barangay} · {department?.name} · {recommendation?.dispatch_label}
        </p>
        {reports[0]?.description ? <p className="mt-2 text-sm">{reports[0].description}</p> : null}
        {reports[0]?.photo_url ? (
          <img src={reports[0].photo_url} alt="Report" className="mt-3 max-h-48 rounded-xl object-cover" />
        ) : null}
      </div>

      <div className="ui-card">
        <p className="ui-card-title">Site location</p>
        <div className="mt-2 h-48 overflow-hidden rounded-xl">
          <CivicMap
            markers={[
              {
                id: incident.id,
                latitude: incident.latitude,
                longitude: incident.longitude,
                primary_issue_type: incident.primary_issue_type,
                type: 'incident',
              },
            ]}
            center={{ lat: incident.latitude, lng: incident.longitude }}
            zoom={15}
            heightClass="h-full"
            hideMapChrome
            flush
          />
        </div>
        <a href={directionsUrl} target="_blank" rel="noreferrer" className="btn-primary mt-3 inline-flex text-sm">
          Open directions
        </a>
      </div>

      <div className="ui-card space-y-3">
        <p className="ui-card-title">Field verification</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Before photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-1 block w-full text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadPhoto('before', f);
              }}
            />
            {assignment.before_photo_url ? (
              <img src={assignment.before_photo_url} alt="Before" className="mt-2 max-h-32 rounded-lg" />
            ) : null}
          </label>
          <label className="text-sm">
            After photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-1 block w-full text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadPhoto('after', f);
              }}
            />
            {assignment.after_photo_url ? (
              <img src={assignment.after_photo_url} alt="After" className="mt-2 max-h-32 rounded-lg" />
            ) : null}
          </label>
        </div>
        <textarea
          className="w-full rounded-xl border border-hairline px-3 py-2 text-sm"
          rows={3}
          placeholder="Notes from site inspection"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={busy}
              className={`map-layer-btn ${assignment.dispatch_status === s.id ? 'map-layer-btn-active' : ''}`}
              onClick={() => void updateStatus(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="ui-card">
        <p className="ui-card-title">Activity log</p>
        <ul className="mt-3 space-y-2">
          {activity.length === 0 ? (
            <li className="text-sm text-ink-muted-48">No updates yet.</li>
          ) : (
            activity.map((a) => (
              <li key={a.id} className="border-l-2 border-primary pl-3 text-sm">
                <p className="font-medium">{a.dispatch_status?.replace(/_/g, ' ') || 'Update'}</p>
                {a.notes ? <p className="text-ink-muted-48">{a.notes}</p> : null}
                <p className="text-xs text-ink-muted-48">{new Date(a.created_at).toLocaleString()}</p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
