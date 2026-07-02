export interface PublicEventDetail {
  id: string;
  title: string;
  description?: string;
  barangay?: string;
  scheduled_start: string;
  scheduled_end?: string;
  approval_status: string;
  organizer_user_id?: string;
  latitude?: number;
  longitude?: number;
  going_count?: number;
  organizer_name?: string;
  organizer_logo_url?: string | null;
  organizer_profile_photo_url?: string | null;
  banner_url?: string | null;
  checkout_qr_code_token?: string | null;
}

export interface EventParticipant {
  user_id: string;
  full_name: string;
}

export interface EventPhoto {
  id: string;
  event_id: string;
  uploaded_by: string;
  image_url: string;
  hidden: boolean;
  created_at: string;
}

export interface EventPhotosResponse {
  photos: EventPhoto[];
  can_upload: boolean;
  can_moderate: boolean;
  can_unhide?: boolean;
}

export const EVENT_CATEGORY_LABEL = 'Cleanup drive';

export const EVENT_BANNER_PLACEHOLDER =
  'https://images.unsplash.com/photo-1532996122720-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80';

export function organizationInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ORG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}
