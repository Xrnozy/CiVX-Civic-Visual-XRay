import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { ButtonPrimary } from '../../components/ui/Buttons';
import { EventBannerUpload } from '../../components/events/EventBannerUpload';
import {
  FORM_FIELD_INPUT,
  LocationPickerSection,
  hasDetectedBarangay,
  hasValidLocation,
} from '../../components/map/LocationPickerSection';
import {
  OrganizerEventDetailCard,
  type OrganizerCleanupEvent,
} from '../../components/organizer/OrganizerEventDetailCard';
import {
  getOrganizerDriveListBadge,
  ORGANIZER_DRIVE_FILTERS,
  ORGANIZER_EVENT_SORT_OPTIONS,
  filterOrganizerCleanupEvents,
  sortOrganizerCleanupEvents,
  type OrganizerDriveFilter,
  type OrganizerEventSort,
} from '../../lib/eventSchedule';
import { useProfile } from '../../hooks/useProfile';
import { useOrganizerCleanup } from './OrganizerLayout';
import { fetchAddressFromCoordinates } from '../../lib/geocoding';
import { formatDefaultMapCoordinates } from '../../shared/constants';
import { formatLocationAddress } from '../../types/pickedAddress';

interface CleanupEvent extends OrganizerCleanupEvent {
  max_volunteers: number;
  created_at?: string;
}

const DEFAULT_COORDS = formatDefaultMapCoordinates();

const EMPTY_FORM = {
  title: '',
  description: '',
  barangay: '',
  street: '',
  city: '',
  province: '',
  scheduled_start: '',
  scheduled_end: '',
  max_volunteers: 50,
  latitude: DEFAULT_COORDS.latitude,
  longitude: DEFAULT_COORDS.longitude,
};

function statusClass(status: string) {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-800';
}

export default function OrganizerCleanupPage() {
  const { profile } = useProfile();
  const { showForm, setShowForm } = useOrganizerCleanup();
  const [events, setEvents] = useState<CleanupEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const [sortBy, setSortBy] = useState<OrganizerEventSort>('start');
  const [statusFilter, setStatusFilter] = useState<OrganizerDriveFilter>('all');

  const filteredEvents = useMemo(
    () => filterOrganizerCleanupEvents(events, statusFilter),
    [events, statusFilter],
  );

  const sortedEvents = useMemo(
    () => sortOrganizerCleanupEvents(filteredEvents, sortBy),
    [filteredEvents, sortBy],
  );

  const load = useCallback(() => {
    api<CleanupEvent[]>('/api/cleanup-events?mine=true').then(setEvents).catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelectedId((prev) => {
      const filtered = filterOrganizerCleanupEvents(events, statusFilter);
      if (prev && filtered.some((ev) => ev.id === prev)) return prev;
      return filtered[0]?.id ?? null;
    });
  }, [events, statusFilter]);

  useEffect(() => {
    if (!selectedId) {
      setGoingCount(0);
      return;
    }
    const selected = events.find((ev) => ev.id === selectedId);
    if (!selected || selected.approval_status !== 'approved') {
      setGoingCount(0);
      return;
    }
    api<{ going_count?: number }>(`/api/cleanup-events/${selectedId}`)
      .then((data) => setGoingCount(data.going_count ?? 0))
      .catch(() => setGoingCount(0));
  }, [events, selectedId]);

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    if (!hasValidLocation(form.latitude, form.longitude)) {
      setFormError('Pin the cleanup location on the map before submitting.');
      return;
    }
    if (!hasDetectedBarangay(form)) {
      setFormError('Wait for barangay detection to finish before submitting.');
      return;
    }
    setFormError('');
    setCreating(true);
    try {
      let address = {
        barangay: form.barangay.trim(),
        street: form.street.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
      };
      if (!address.barangay) {
        address = await fetchAddressFromCoordinates(Number(form.latitude), Number(form.longitude));
      }
      const payload = {
        ...form,
        ...address,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        ...(bannerUrl ? { banner_url: bannerUrl } : {}),
      };
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'OrganizerCleanupPage.tsx:createEvent',message:'create cleanup with banner',data:{hasBanner:Boolean(bannerUrl)},timestamp:Date.now(),hypothesisId:'H1',runId:'banner-feature'})}).catch(()=>{});
      // #endregion
      await api('/api/cleanup-events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setBannerUrl('');
      setBannerPreview('');
      load();
    } finally {
      setCreating(false);
    }
  }

  const selectedEvent = events.find((ev) => ev.id === selectedId) ?? null;
  const organizerName = profile?.organization_name || profile?.full_name || 'Organizer';

  async function updateSelectedBanner(url: string) {
    if (!selectedEvent || !url) return;
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'OrganizerCleanupPage.tsx:updateSelectedBanner',message:'patch event banner',data:{eventId:selectedEvent.id,hasUrl:Boolean(url)},timestamp:Date.now(),hypothesisId:'H2',runId:'banner-feature'})}).catch(()=>{});
    // #endregion
    await api(`/api/cleanup-events/${selectedEvent.id}/banner`, {
      method: 'PATCH',
      body: JSON.stringify({ banner_url: url }),
    });
    load();
  }

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <div className="page-content">
        <p className="eyebrow mb-0">Organizer</p>
        <h1 className="mt-2 text-[34px] font-semibold tracking-tight text-ink md:text-[40px]">
          Cleanup drives
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted-80">
          Plan community cleanups, pin the meeting point on the map, and submit for LGU approval before
          volunteers can join.
        </p>

        {showForm && (
          <form
            id="create-drive"
            onSubmit={createEvent}
            className="store-utility-card mt-8 grid gap-8 bg-canvas p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:p-8"
          >
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">Drive details</h2>
                <p className="mt-1 text-sm text-ink-muted-48">Describe the cleanup and when volunteers should arrive.</p>
              </div>

              <EventBannerUpload
                value={bannerUrl}
                previewUrl={bannerPreview}
                onChange={(url, preview) => {
                  setBannerUrl(url);
                  setBannerPreview(preview);
                }}
              />

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Title</span>
                <input
                  className={FORM_FIELD_INPUT}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Brgy 5 canal cleanup"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Description</span>
                <textarea
                  className={`min-h-28 ${FORM_FIELD_INPUT}`}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What volunteers should bring, meet-up notes, etc."
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Max volunteers</span>
                <input
                  className={FORM_FIELD_INPUT}
                  type="number"
                  min={1}
                  value={form.max_volunteers}
                  onChange={(e) => setForm({ ...form, max_volunteers: Number(e.target.value) })}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Start</span>
                  <input
                    className={FORM_FIELD_INPUT}
                    type="datetime-local"
                    value={form.scheduled_start}
                    onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">End</span>
                  <input
                    className={FORM_FIELD_INPUT}
                    type="datetime-local"
                    value={form.scheduled_end}
                    onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })}
                    required
                  />
                </label>
              </div>
            </div>

            <div className="rounded-[20px] border border-hairline bg-canvas-parchment p-5">
              <LocationPickerSection
                embedded
                latitude={form.latitude}
                longitude={form.longitude}
                address={{
                  barangay: form.barangay,
                  street: form.street,
                  city: form.city,
                  province: form.province,
                }}
                autoDetectAddress
                onAddressChange={(addr) =>
                  setForm((prev) => ({
                    ...prev,
                    barangay: addr.barangay,
                    street: addr.street,
                    city: addr.city,
                    province: addr.province,
                  }))
                }
                onChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
                label="Cleanup location"
                hint="Pin where volunteers should meet. Address fields fill in automatically once barangay is detected."
              />
            </div>

            {formError && <p className="text-sm text-red-600 lg:col-span-2">{formError}</p>}

            <ButtonPrimary type="submit" className="justify-center lg:col-span-2" disabled={creating}>
              {creating ? 'Submitting…' : 'Submit for LGU approval'}
            </ButtonPrimary>
          </form>
        )}

        <div className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">My drives</h2>
              <p className="mt-1 text-sm text-ink-muted-48">
                {filteredEvents.length} of {events.length} drive{events.length === 1 ? '' : 's'} · approved
                drives appear on the public map
              </p>
            </div>
            {events.length > 0 ? (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-muted-80">Sort by</span>
                <select
                  className={`min-w-[180px] ${FORM_FIELD_INPUT}`}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as OrganizerEventSort)}
                >
                  {ORGANIZER_EVENT_SORT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {events.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex rounded-full border border-hairline p-1">
                {ORGANIZER_DRIVE_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      statusFilter === filter.id ? 'bg-primary text-white' : 'text-ink-muted-80'
                    }`}
                    onClick={() => setStatusFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0 space-y-3">
              {sortedEvents.map((ev) => {
                const listBadge = getOrganizerDriveListBadge(ev);
                return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedId(ev.id)}
                  className={`store-utility-card flex w-full flex-wrap items-start justify-between gap-3 bg-canvas text-left transition ${
                    selectedId === ev.id ? 'border-primary ring-2 ring-primary/20' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{ev.title}</p>
                    <p className="mt-1 text-sm text-ink-muted-48">
                      {formatLocationAddress(ev) || ev.barangay || '—'} · {new Date(ev.scheduled_start).toLocaleString()}
                    </p>
                    {ev.latitude != null && ev.longitude != null && !formatLocationAddress(ev) ? (
                      <p className="mt-1 text-xs text-ink-muted-48">
                        Pin: {Number(ev.latitude).toFixed(5)}, {Number(ev.longitude).toFixed(5)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {listBadge ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${listBadge.className}`}>
                        {listBadge.label}
                      </span>
                    ) : null}
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(ev.approval_status)}`}>
                      {ev.approval_status.replace('_', ' ')}
                    </span>
                  </div>
                </button>
              );
              })}
              {events.length === 0 ? (
                <div className="store-utility-card bg-canvas py-12 text-center text-sm text-ink-muted-48">
                  No cleanup drives yet. Use <strong className="text-ink">New cleanup drive</strong> above to plan your first one.
                </div>
              ) : sortedEvents.length === 0 ? (
                <div className="store-utility-card bg-canvas py-12 text-center text-sm text-ink-muted-48">
                  No drives match this filter.
                </div>
              ) : null}
            </div>

            {!selectedEvent ? (
              <div className="sticky-below-chrome store-utility-card bg-canvas py-12 text-center text-sm text-ink-muted-48">
                Select a drive to view details.
              </div>
            ) : (
              <div className="space-y-4">
                <OrganizerEventDetailCard
                  event={selectedEvent}
                  organizerName={organizerName}
                  goingCount={goingCount}
                  sticky={false}
                />
                <div className="store-utility-card bg-canvas p-4">
                  <EventBannerUpload
                    value={selectedEvent.banner_url || ''}
                    previewUrl=""
                    label="Community banner"
                    hint="Shown on the public event page and map preview."
                    onChange={(url) => {
                      if (url) void updateSelectedBanner(url);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
