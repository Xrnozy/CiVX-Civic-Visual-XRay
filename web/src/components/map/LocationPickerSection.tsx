import { useMemo } from 'react';
import { CivicMap } from './CivicMap';
import { ButtonPrimary } from '../ui/Buttons';

export const FORM_FIELD_INPUT =
  'w-full rounded-[16px] border border-hairline bg-canvas px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted-48 focus:border-primary focus:ring-2 focus:ring-primary/20';

interface LocationPickerSectionProps {
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
  label?: string;
  hint?: string;
  embedded?: boolean;
}

export function LocationPickerSection({
  latitude,
  longitude,
  onChange,
  label = 'Location',
  hint = 'Click the map to pin a point, or use your current location.',
  embedded = false,
}: LocationPickerSectionProps) {
  const selectedLocation = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [latitude, longitude]);

  function pinLocation(lat: number, lng: number) {
    onChange(lat.toFixed(6), lng.toFixed(6));
  }

  function captureGeo() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => pinLocation(pos.coords.latitude, pos.coords.longitude),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const content = (
    <>
      <div>
        <h2 className="text-lg font-semibold text-ink">{label}</h2>
        <p className="mt-1 text-sm text-ink-muted-48">{hint}</p>
      </div>

      <div className="map-shell mt-4 min-h-[280px]">
        <CivicMap
          markers={[]}
          selectedLocation={selectedLocation}
          onLocationPick={(lat, lng) => pinLocation(lat, lng)}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Latitude</span>
          <input
            className={FORM_FIELD_INPUT}
            value={latitude}
            onChange={(e) => onChange(e.target.value, longitude)}
            placeholder="14.579359"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Longitude</span>
          <input
            className={FORM_FIELD_INPUT}
            value={longitude}
            onChange={(e) => onChange(latitude, e.target.value)}
            placeholder="121.040089"
          />
        </label>
      </div>

      <div className="mt-4">
        <ButtonPrimary type="button" onClick={captureGeo}>
          Use my location
        </ButtonPrimary>
      </div>

      <p className="mt-3 text-sm text-ink-muted-48">
        {selectedLocation
          ? `Pinned location: ${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
          : 'No pin set yet.'}
      </p>
    </>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <section className="rounded-[24px] border border-hairline bg-canvas p-5 md:p-6">{content}</section>
  );
}

export function hasValidLocation(latitude: string, longitude: string): boolean {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}
