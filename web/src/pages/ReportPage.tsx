import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { Footer } from '../components/ui/Footer';
import { ButtonPrimary } from '../components/ui/Buttons';
import { FORM_FIELD_INPUT, LocationPickerSection, hasValidLocation } from '../components/map/LocationPickerSection';
import { api } from '../lib/api';
import { ISSUE_CATEGORIES } from '../shared/constants';
import { useAuth } from '../hooks/useAuth';

type ReportResult = { incident_id?: string; merged?: boolean };
type ReportPhoto = { id: string; file: File; previewUrl: string };

const MAX_PHOTOS = 3;

function makeId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ReportPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [issueType, setIssueType] = useState('garbage_pile');
  const [description, setDescription] = useState('');
  const [barangay, setBarangay] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);

  const selectedLocation = useMemo(() => {
    if (!hasValidLocation(latitude, longitude)) return null;
    return { latitude: Number(latitude), longitude: Number(longitude) };
  }, [latitude, longitude]);

  const canSubmit = useMemo(() => {
    return Boolean(photos.length > 0 && selectedLocation && !submitting);
  }, [photos.length, selectedLocation, submitting]);

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate('/login?next=/report', { replace: true });
  }, [ready, user, navigate]);

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [photos]);

  function handlePhotoChange(files: FileList | null) {
    if (!files || !files.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    const accepted = Array.from(files)
      .slice(0, remaining)
      .map((file) => ({ id: makeId(file), file, previewUrl: URL.createObjectURL(file) }));

    if (files.length > remaining) {
      window.alert(`You can attach up to ${MAX_PHOTOS} photos.`);
    }

    setPhotos((current) => [...current, ...accepted]);
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  }

  async function submit() {
    if (!photos.length || !selectedLocation) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      photos.forEach((photo) => {
        form.append('photos', photo.file);
      });
      form.append('latitude', String(selectedLocation.latitude));
      form.append('longitude', String(selectedLocation.longitude));
      form.append('description', description.trim() || 'Web report');
      form.append('issue_type', issueType);
      if (barangay.trim()) form.append('barangay', barangay.trim());

      const data = await api<ReportResult>('/api/reports', { method: 'POST', body: form });
      setResult(data);
      setDescription('');
      setBarangay('');
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setPhotos([]);
      setIssueType('garbage_pile');
      setLatitude('');
      setLongitude('');
    } finally {
      setSubmitting(false);
    }
  }

  if (ready && !user) return null;

  return (
    <div className="min-h-screen bg-canvas">
      <GlobalNav />
      <div className="page-content py-12">
        <div className="mx-auto max-w-6xl rounded-[24px] border border-hairline bg-canvas p-5 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Citizen report</p>
          <h1 className="mt-2 text-[40px] font-semibold tracking-tight text-ink">Report an issue</h1>
          <p className="mt-2 text-sm text-ink-muted-80">Capture photos, pin the location on the map, and send the report into the LGU queue.</p>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <section className="rounded-[24px] border border-hairline bg-canvas p-5 md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Photos</h2>
                    <p className="mt-1 text-sm text-ink-muted-48">Attach up to {MAX_PHOTOS} images for better review.</p>
                  </div>
                  <span className="rounded-full bg-canvas-parchment px-3 py-1 text-xs font-medium text-ink-muted-80">
                    {photos.length}/{MAX_PHOTOS}
                  </span>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-ink">Add photos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={(e) => handlePhotoChange(e.target.files)}
                    className={`${FORM_FIELD_INPUT} file:mr-4 file:rounded-full file:border-0 file:bg-canvas-parchment file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink`}
                  />
                </label>

                {photos.length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {photos.map((photo) => (
                      <div key={photo.id} className="group relative overflow-hidden rounded-[18px] border border-hairline bg-canvas-parchment">
                        <img src={photo.previewUrl} alt={photo.file.name} className="h-40 w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
                          <span className="truncate text-xs text-white">{photo.file.name}</span>
                          <button
                            type="button"
                            onClick={() => removePhoto(photo.id)}
                            className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[18px] border border-dashed border-hairline bg-canvas-parchment px-4 py-10 text-center text-sm text-ink-muted-48">
                    Add one to three photos to document the issue clearly.
                  </div>
                )}
              </section>

              <LocationPickerSection
                latitude={latitude}
                longitude={longitude}
                onChange={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
              />
            </div>

            <div className="space-y-6">
              <section className="rounded-[24px] border border-hairline bg-canvas p-5 md:p-6">
                <h2 className="text-lg font-semibold text-ink">Issue details</h2>
                <p className="mt-1 text-sm text-ink-muted-48">Use the existing civic issue categories and add a short description.</p>

                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-medium text-ink">Issue type</span>
                  <select className={FORM_FIELD_INPUT} value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                    {ISSUE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-ink">Description</span>
                  <textarea
                    className={`min-h-36 ${FORM_FIELD_INPUT}`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a short description"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-ink">Barangay</span>
                  <input
                    className={FORM_FIELD_INPUT}
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </section>

              <section className="rounded-[24px] border border-hairline bg-canvas-parchment p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Submit</h2>
                    <p className="mt-1 text-sm text-ink-muted-48">Your report will appear in the queue after duplicate checking.</p>
                  </div>
                  {result?.incident_id ? <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-primary">Submitted</span> : null}
                </div>

                {result?.incident_id ? (
                  <div className="mt-4 rounded-[18px] border border-hairline bg-canvas p-4 text-sm text-ink-muted-80">
                    <p className="font-semibold text-ink">Submitted</p>
                    <p className="mt-2 break-all">Incident ID: {result.incident_id}</p>
                    <p className="mt-1">{result.merged ? 'Merged into an existing incident.' : 'Created as a new incident.'}</p>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonPrimary type="button" onClick={submit} disabled={!canSubmit}>
                    {submitting ? 'Submitting…' : 'Submit report'}
                  </ButtonPrimary>
                </div>

                <div className="mt-5 text-sm text-ink-muted-48">
                  <p>Need to sign in first? <Link className="text-primary underline" to="/login?next=/report">Continue to login</Link>.</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
