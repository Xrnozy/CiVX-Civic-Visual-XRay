import { useEffect, useMemo, useRef, useState } from 'react';
import { CivicMap } from './CivicMap';
import { ButtonPrimary } from '../ui/Buttons';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_PIN_ZOOM, DEFAULT_MAP_ZOOM } from '../../shared/constants';
import { fetchBarangayFromCoordinates } from '../../lib/geocoding';

const NO_MAP_MARKERS: never[] = [];

export const FORM_FIELD_INPUT =
  'w-full rounded-[16px] border border-hairline bg-canvas px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted-48 focus:border-primary focus:ring-2 focus:ring-primary/20';

interface LocationPickerSectionProps {
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
  label?: string;
  hint?: string;
  embedded?: boolean;
  barangay?: string;
  onBarangayChange?: (barangay: string) => void;
  autoBarangay?: boolean;
}

export function LocationPickerSection({
  latitude,
  longitude,
  onChange,
  label = 'Location',
  hint = 'Click the map to pin a point, or use your current location.',
  embedded = false,
  barangay = '',
  onBarangayChange,
  autoBarangay = false,
}: LocationPickerSectionProps) {
  const [geocodingBarangay, setGeocodingBarangay] = useState(false);
  const geocodeRequestId = useRef(0);
  const barangayTouchedRef = useRef(false);
  const onBarangayChangeRef = useRef(onBarangayChange);
  onBarangayChangeRef.current = onBarangayChange;

  const selectedLocation = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [latitude, longitude]);

  useEffect(() => {
    barangayTouchedRef.current = false;
  }, [latitude, longitude]);

  useEffect(() => {
    if (!autoBarangay || !onBarangayChangeRef.current || !selectedLocation) return;

    const requestId = ++geocodeRequestId.current;
    setGeocodingBarangay(true);

    const timer = window.setTimeout(() => {
      void fetchBarangayFromCoordinates(selectedLocation.latitude, selectedLocation.longitude)
        .then((resolved) => {
          if (geocodeRequestId.current !== requestId) return;
          if (!barangayTouchedRef.current && resolved) {
            onBarangayChangeRef.current?.(resolved);
          }
        })
        .catch(() => {
          /* keep manual value */
        })
        .finally(() => {
          if (geocodeRequestId.current === requestId) {
            setGeocodingBarangay(false);
          }
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoBarangay, latitude, longitude]);

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

  const mapCenter = selectedLocation
    ? { lat: selectedLocation.latitude, lng: selectedLocation.longitude }
    : DEFAULT_MAP_CENTER;
  const mapZoom = selectedLocation ? DEFAULT_MAP_PIN_ZOOM : DEFAULT_MAP_ZOOM;

  const content = (
    <>
      <div>
        <h2 className="text-lg font-semibold text-ink">{label}</h2>
        <p className="mt-1 text-sm text-ink-muted-48">{hint}</p>
      </div>

      <div className="map-shell mt-4 min-h-[280px]">
        <CivicMap
          markers={NO_MAP_MARKERS}
          center={mapCenter}
          zoom={mapZoom}
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
            placeholder={DEFAULT_MAP_CENTER.lat.toFixed(6)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Longitude</span>
          <input
            className={FORM_FIELD_INPUT}
            value={longitude}
            onChange={(e) => onChange(latitude, e.target.value)}
            placeholder={DEFAULT_MAP_CENTER.lng.toFixed(6)}
          />
        </label>
      </div>

      {autoBarangay && onBarangayChange ? (
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-medium text-ink">Barangay</span>
          <input
            className={FORM_FIELD_INPUT}
            value={barangay}
            onChange={(e) => {
              barangayTouchedRef.current = true;
              onBarangayChange(e.target.value);
            }}
            placeholder={geocodingBarangay ? 'Detecting from map pin…' : 'Set a map pin to detect barangay'}
          />
          <p className="mt-1 text-xs text-ink-muted-48">
            {geocodingBarangay
              ? 'Looking up barangay from your pinned location…'
              : barangay
                ? 'Auto-detected from your pin. You can edit if needed.'
                : 'Barangay is filled automatically when you pin the location.'}
          </p>
        </label>
      ) : null}

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
