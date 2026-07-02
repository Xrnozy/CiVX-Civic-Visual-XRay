import { api } from './api';
import type { PickedAddress } from '../types/pickedAddress';
import { EMPTY_PICKED_ADDRESS } from '../types/pickedAddress';

function normalizeAddress(data: Partial<PickedAddress> | null | undefined): PickedAddress {
  return {
    barangay: data?.barangay?.trim() || '',
    street: data?.street?.trim() || '',
    city: data?.city?.trim() || '',
    province: data?.province?.trim() || '',
  };
}

export async function fetchAddressFromCoordinates(
  latitude: number,
  longitude: number,
): Promise<PickedAddress> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  try {
    const data = await api<Partial<PickedAddress>>(`/api/maps/address?${params.toString()}`);
    return normalizeAddress(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('404') && !message.toLowerCase().includes('not found')) {
      throw err;
    }
    const legacy = await api<{ barangay?: string | null }>(`/api/maps/barangay?${params.toString()}`);
    return normalizeAddress({ barangay: legacy.barangay ?? '' });
  }
}

/** @deprecated Use fetchAddressFromCoordinates */
export async function fetchBarangayFromCoordinates(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const address = await fetchAddressFromCoordinates(latitude, longitude);
  return address.barangay || null;
}

export { EMPTY_PICKED_ADDRESS };
