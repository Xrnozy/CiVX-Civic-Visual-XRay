export interface PublicEventDetail {
  id: string;
  title: string;
  description?: string;
  barangay?: string;
  scheduled_start: string;
  scheduled_end?: string;
  approval_status: string;
  latitude?: number;
  longitude?: number;
  going_count?: number;
  organizer_name?: string;
  organizer_profile_photo_url?: string | null;
  banner_url?: string | null;
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
}

export const EVENT_CATEGORY_LABEL = 'Cleanup drive';

export const EVENT_BANNER_PLACEHOLDER =
  'https://images.unsplash.com/photo-1532996122720-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80';

export const ORGANIZER_AVATAR_PLACEHOLDER =
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80';
