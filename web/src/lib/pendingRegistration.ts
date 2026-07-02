import type { AccountType } from '../types/user';
import type { CompleteRegistrationPayload } from './auth';
import { uploadProfileImage } from '../components/auth/ProfileImageUpload';

const STORAGE_KEY = 'civx_pending_registration';

export interface PendingRegistration {
  account_type: AccountType;
  full_name: string;
  phone_number: string;
  barangay: string;
  organization_name?: string;
  organization_logo_url?: string;
  profile_photo_url?: string;
  organization_logo_data_url?: string;
  profile_photo_data_url?: string;
  invite_token?: string;
  public_worker_type?: string;
}

export function savePendingRegistration(data: PendingRegistration): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22);
    if (isQuota) {
      throw new Error('Registration data is too large to store. Try a smaller logo image.');
    }
    throw err;
  }
}

/** Merge form fields into stored pending data without losing image data URLs. */
export function mergePendingRegistration(
  existing: PendingRegistration | null,
  updates: PendingRegistration,
): PendingRegistration {
  const merged: PendingRegistration = { ...(existing ?? {}), ...updates };

  if (updates.organization_logo_url?.startsWith('data:')) {
    merged.organization_logo_data_url = updates.organization_logo_url;
    merged.organization_logo_url = undefined;
  } else if (hasPersistedUrl(updates.organization_logo_url)) {
    merged.organization_logo_url = updates.organization_logo_url;
    merged.organization_logo_data_url = undefined;
  } else if (updates.organization_logo_url?.startsWith('blob:')) {
    merged.organization_logo_url = updates.organization_logo_url;
  }

  if (updates.profile_photo_url?.startsWith('data:')) {
    merged.profile_photo_data_url = updates.profile_photo_url;
    merged.profile_photo_url = undefined;
  } else if (hasPersistedUrl(updates.profile_photo_url)) {
    merged.profile_photo_url = updates.profile_photo_url;
    merged.profile_photo_data_url = undefined;
  } else if (updates.profile_photo_url?.startsWith('blob:')) {
    merged.profile_photo_url = updates.profile_photo_url;
  }

  return merged;
}

export function loadPendingRegistration(): PendingRegistration | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingRegistration;
  } catch {
    return null;
  }
}

export function clearPendingRegistration(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

function hasPersistedUrl(url?: string): boolean {
  return Boolean(url && !url.startsWith('blob:'));
}

export function isPendingRegistrationComplete(pending: PendingRegistration): boolean {
  if (!pending.account_type || !pending.full_name?.trim() || !pending.phone_number?.trim() || !pending.barangay?.trim()) {
    return false;
  }
  if (pending.account_type === 'street_sweeper') {
    if (!pending.public_worker_type) return false;
    if (!pending.invite_token) return false;
  }
  if (pending.account_type === 'organizer') {
    if (!pending.organization_name?.trim()) return false;
    const hasLogo =
      hasPersistedUrl(pending.organization_logo_url) || Boolean(pending.organization_logo_data_url);
    if (!hasLogo) return false;
  }
  return true;
}

export function pendingToPayload(pending: PendingRegistration): CompleteRegistrationPayload {
  return {
    account_type: pending.account_type,
    full_name: pending.full_name.trim(),
    phone_number: pending.phone_number.trim(),
    barangay: pending.barangay.trim(),
    organization_name: pending.organization_name?.trim() || undefined,
    organization_logo_url: hasPersistedUrl(pending.organization_logo_url)
      ? pending.organization_logo_url
      : undefined,
    profile_photo_url: hasPersistedUrl(pending.profile_photo_url) ? pending.profile_photo_url : undefined,
    invite_token: pending.invite_token || undefined,
    public_worker_type: pending.public_worker_type || undefined,
  };
}

/** Upload images stored as data URLs after Firebase sign-in. */
export async function resolvePendingMediaUrls(
  pending: PendingRegistration,
): Promise<PendingRegistration> {
  let organization_logo_url = pending.organization_logo_url;
  let profile_photo_url = pending.profile_photo_url;

  if (pending.organization_logo_data_url && !hasPersistedUrl(organization_logo_url)) {
    const file = await dataUrlToFile(pending.organization_logo_data_url, 'organization-logo.png');
    organization_logo_url = await uploadProfileImage(file);
  }
  if (pending.profile_photo_data_url && !hasPersistedUrl(profile_photo_url)) {
    const file = await dataUrlToFile(pending.profile_photo_data_url, 'profile-photo.png');
    profile_photo_url = await uploadProfileImage(file);
  }

  return {
    ...pending,
    organization_logo_url,
    profile_photo_url,
  };
}

export async function buildPendingRegistration(input: {
  accountType: AccountType | null;
  fullName: string;
  phone: string;
  barangay: string;
  organizationName: string;
  organizationLogoUrl: string;
  organizationLogoFile: File | null;
  profilePhotoUrl: string;
  profilePhotoFile: File | null;
  inviteToken: string;
  publicWorkerType: string;
}): Promise<PendingRegistration | null> {
  if (!input.accountType) return null;

  let organization_logo_data_url: string | undefined;
  let profile_photo_data_url: string | undefined;

  if (input.organizationLogoFile) {
    organization_logo_data_url = await fileToDataUrl(input.organizationLogoFile);
  }
  if (input.profilePhotoFile) {
    profile_photo_data_url = await fileToDataUrl(input.profilePhotoFile);
  }

  return {
    account_type: input.accountType,
    full_name: input.fullName,
    phone_number: input.phone,
    barangay: input.barangay,
    organization_name: input.organizationName || undefined,
    organization_logo_url: hasPersistedUrl(input.organizationLogoUrl) ? input.organizationLogoUrl : undefined,
    profile_photo_url: hasPersistedUrl(input.profilePhotoUrl) ? input.profilePhotoUrl : undefined,
    organization_logo_data_url,
    profile_photo_data_url,
    invite_token: input.inviteToken || undefined,
    public_worker_type: input.publicWorkerType || undefined,
  };
}

export async function finishPendingRegistration(
  pending: PendingRegistration,
): Promise<CompleteRegistrationPayload> {
  const resolved = await resolvePendingMediaUrls(pending);
  const payload = pendingToPayload(resolved);
  if (payload.account_type === 'organizer' && !payload.organization_logo_url) {
    throw new Error('Organization logo is required. Please upload your logo again.');
  }
  return payload;
}
