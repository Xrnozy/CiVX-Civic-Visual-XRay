import { useEffect, useMemo, useRef, useState } from 'react';
import { CivicMap } from './CivicMap';
import { ButtonPrimary } from '../ui/Buttons';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_PIN_ZOOM, DEFAULT_MAP_ZOOM } from '../../shared/constants';
import { EMPTY_PICKED_ADDRESS, fetchAddressFromCoordinates } from '../../lib/geocoding';
import type { PickedAddress } from '../../types/pickedAddress';

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
  address?: PickedAddress;
  onAddressChange?: (address: PickedAddress) => void;
  /** @deprecated Use address + onAddressChange */
  barangay?: string;
  /** @deprecated Use onAddressChange */
  onBarangayChange?: (barangay: string) => void;
  autoBarangay?: boolean;
  autoDetectAddress?: boolean;
}

export function LocationPickerSection({
  latitude,
  longitude,
  onChange,
  label = 'Location',
  hint = 'Click the map to pin a point, or use your current location.',
  embedded = false,
  address,
  onAddressChange,
  barangay = '',
  onBarangayChange,
  autoBarangay = false,
  autoDetectAddress = false,
}: LocationPickerSectionProps) {
  const detectAddress = autoDetectAddress || autoBarangay;
  const [geocoding, setGeocoding] = useState(false);
  const geocodeRequestId = useRef(0);
  const addressTouchedRef = useRef(false);
  const onAddressChangeRef = useRef(onAddressChange);
  onAddressChangeRef.current = onAddressChange;

  const resolvedAddress: PickedAddress = address ?? {
    ...EMPTY_PICKED_ADDRESS,
    barangay: barangay || '',
  };
  const addressReady = Boolean(resolvedAddress.barangay.trim());

  const selectedLocation = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [latitude, longitude]);

  useEffect(() => {
    addressTouchedRef.current = false;
    if (detectAddress && onAddressChangeRef.current && selectedLocation) {
      onAddressChangeRef.current(EMPTY_PICKED_ADDRESS);
      onBarangayChange?.('');
    }
  }, [latitude, longitude, detectAddress, onBarangayChange, selectedLocation]);

  useEffect(() => {
    if (!detectAddress || !onAddressChangeRef.current || !selectedLocation) return;

    const requestId = ++geocodeRequestId.current;
    setGeocoding(true);

    const timer = window.setTimeout(() => {
      void fetchAddressFromCoordinates(selectedLocation.latitude, selectedLocation.longitude)
        .then((resolved) => {
          if (geocodeRequestId.current !== requestId) return;
          if (!addressTouchedRef.current) {
            onAddressChangeRef.current?.(resolved);
            onBarangayChange?.(resolved.barangay);
            // #region agent log
            fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8b92e3' },
              body: JSON.stringify({
                sessionId: '8b92e3',
                location: 'LocationPickerSection.tsx:geocodeDone',
                message: 'address detected',
                data: {
                  hasBarangay: Boolean(resolved.barangay?.trim()),
                  hasStreet: Boolean(resolved.street?.trim()),
                  hasCity: Boolean(resolved.city?.trim()),
                  hasProvince: Boolean(resolved.province?.trim()),
                },
                timestamp: Date.now(),
                hypothesisId: 'H-address-fields',
                runId: 'address-feature',
              }),
            }).catch(() => {});
            // #endregion
          }
        })
        .catch((err) => {
          // #region agent log
          fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8b92e3' },
            body: JSON.stringify({
              sessionId: '8b92e3',
              location: 'LocationPickerSection.tsx:geocodeError',
              message: 'address geocode failed',
              data: { error: err instanceof Error ? err.message : String(err) },
              timestamp: Date.now(),
              hypothesisId: 'H-address-404',
              runId: 'address-feature',
            }),
          }).catch(() => {});
          // #endregion
        })
        .finally(() => {
          if (geocodeRequestId.current === requestId) {
            setGeocoding(false);
          }
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [detectAddress, latitude, longitude, onBarangayChange]);

  function updateAddressField<K extends keyof PickedAddress>(field: K, value: string) {
    addressTouchedRef.current = true;
    const next = { ...resolvedAddress, [field]: value };
    onAddressChange?.(next);
    if (field === 'barangay') {
      onBarangayChange?.(value);
    }
  }

  function pinLocation(lat: number, lng: number) {
    const locked =
      Boolean(detectAddress && Number.isFinite(lat) && Number.isFinite(lng)) &&
      (geocoding || !addressReady);
    if (locked) return;
    onChange(lat.toFixed(6), lng.toFixed(6));
  }

  function captureGeo() {
    if (!navigator.geolocation) return;
    const locked = Boolean(detectAddress && selectedLocation) && (geocoding || !addressReady);
    if (locked) return;
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
  const mapLocked =
    Boolean(detectAddress && selectedLocation) && (geocoding || !addressReady);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8b92e3' },
      body: JSON.stringify({
        sessionId: '8b92e3',
        location: 'LocationPickerSection.tsx:mapLock',
        message: 'map lock state',
        data: {
          mapLocked,
          geocoding,
          addressReady,
          detectAddress,
          hasPin: Boolean(selectedLocation),
          barangayLen: resolvedAddress.barangay.trim().length,
        },
        timestamp: Date.now(),
        hypothesisId: 'H-map-lock',
        runId: 'address-feature',
      }),
    }).catch(() => {});
  }, [mapLocked, geocoding, addressReady, detectAddress, selectedLocation, resolvedAddress.barangay]);
  // #endregion

  const content = (
    <>
      <div>
        <h2 className="text-lg font-semibold text-ink">{label}</h2>
        <p className="mt-1 text-sm text-ink-muted-48">
          {detectAddress
            ? 'Pin a location or use GPS. The map unlocks after barangay is detected.'
            : hint}
        </p>
      </div>

      <div className="relative mt-4 min-h-[280px]">
        <div className={`map-shell h-full min-h-[280px] ${mapLocked ? 'pointer-events-none' : ''}`}>
          <CivicMap
            markers={NO_MAP_MARKERS}
            center={mapCenter}
            zoom={mapZoom}
            selectedLocation={selectedLocation}
            locationPickDisabled={mapLocked}
            onLocationPick={(lat, lng) => pinLocation(lat, lng)}
          />
        </div>
        {mapLocked ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[24px] bg-white/70 backdrop-blur-[1px]">
            <p className="rounded-full bg-canvas px-4 py-2 text-sm font-medium text-ink shadow-sm">
              {geocoding ? 'Detecting address from pin…' : 'Waiting for barangay detection…'}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Latitude</span>
          <input
            className={FORM_FIELD_INPUT}
            value={latitude}
            onChange={(e) => onChange(e.target.value, longitude)}
            placeholder={DEFAULT_MAP_CENTER.lat.toFixed(6)}
            disabled={geocoding}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Longitude</span>
          <input
            className={FORM_FIELD_INPUT}
            value={longitude}
            onChange={(e) => onChange(latitude, e.target.value)}
            placeholder={DEFAULT_MAP_CENTER.lng.toFixed(6)}
            disabled={geocoding}
          />
        </label>
      </div>

      {detectAddress && onAddressChange ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-ink">Street</span>
            <input
              className={FORM_FIELD_INPUT}
              value={resolvedAddress.street}
              onChange={(e) => updateAddressField('street', e.target.value)}
              placeholder={geocoding ? 'Detecting…' : 'Street'}
              disabled={geocoding}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Barangay</span>
            <input
              className={FORM_FIELD_INPUT}
              value={resolvedAddress.barangay}
              onChange={(e) => updateAddressField('barangay', e.target.value)}
              placeholder={geocoding ? 'Detecting…' : 'Barangay'}
              disabled={geocoding}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">City</span>
            <input
              className={FORM_FIELD_INPUT}
              value={resolvedAddress.city}
              onChange={(e) => updateAddressField('city', e.target.value)}
              placeholder={geocoding ? 'Detecting…' : 'City'}
              disabled={geocoding}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-ink">Province</span>
            <input
              className={FORM_FIELD_INPUT}
              value={resolvedAddress.province}
              onChange={(e) => updateAddressField('province', e.target.value)}
              placeholder={geocoding ? 'Detecting…' : 'Province'}
              disabled={geocoding}
            />
          </label>
          <p className="text-xs text-ink-muted-48 md:col-span-2">
            {geocoding
              ? 'Please wait while we detect the address from your pin.'
              : addressReady
                ? 'Auto-detected from your pin. You can edit any field if needed.'
                : 'Move the pin or use GPS to detect the address.'}
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        <ButtonPrimary type="button" onClick={captureGeo} disabled={geocoding}>
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

export function hasDetectedBarangay(address?: PickedAddress): boolean {
  return Boolean(address?.barangay?.trim());
}
