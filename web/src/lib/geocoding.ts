import { api } from './api';

export async function fetchBarangayFromCoordinates(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  const data = await api<{ barangay: string | null }>(`/api/maps/barangay?${params.toString()}`);
  return data.barangay?.trim() || null;
}
