export interface PickedAddress {
  barangay: string;
  street: string;
  city: string;
  province: string;
}

export const EMPTY_PICKED_ADDRESS: PickedAddress = {
  barangay: '',
  street: '',
  city: '',
  province: '',
};

export type LocationAddressFields = Pick<PickedAddress, 'street' | 'barangay' | 'city'>;

export function formatLocationAddress(address?: Partial<LocationAddressFields> | null): string {
  const parts = [address?.street, address?.barangay, address?.city]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.join(', ');
}
