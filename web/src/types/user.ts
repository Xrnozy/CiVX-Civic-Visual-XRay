export type AccountType = 'citizen' | 'organizer' | 'street_sweeper';

export interface UserProfile {
  id: string;
  firebase_uid: string;
  full_name: string;
  email?: string;
  phone_number?: string;
  barangay?: string;
  organization_name?: string;
  organization_logo_url?: string | null;
  profile_photo_url?: string | null;
  role: string;
  registration_completed?: boolean;
  registration_completed_at?: string | null;
  invite_id?: string | null;
  public_worker_type?: string | null;
}

export interface InviteValidation {
  valid: boolean;
  status: string;
  barangay?: string;
  label?: string;
  expires_at?: string;
  target_role?: string;
}

export interface RegistrationInvite {
  id: string;
  token: string;
  label?: string;
  barangay?: string;
  expires_at: string;
  status: string;
  used_at?: string;
  used_by?: string;
  register_url?: string;
  created_at: string;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  citizen: 'Community member',
  organizer: 'Community leader (NGO)',
  street_sweeper: 'Public Workers',
};

export const PUBLIC_WORKER_TYPES = {
  street_sweeper: 'Street sweeper',
  garbage_collector: 'Garbage collector',
  public_driver: 'Public driver',
  barangay_worker: 'Barangay worker',
  lgu_vehicle_operator: 'LGU vehicle operator',
  patrol: 'Patrol / security',
} as const;

export type PublicWorkerType = keyof typeof PUBLIC_WORKER_TYPES;

export function publicWorkerTypeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return PUBLIC_WORKER_TYPES[type as PublicWorkerType] || type.replace(/_/g, ' ');
}

export const REGISTRATION_INVITE_STATUSES = ['active', 'used', 'expired', 'revoked'] as const;

export interface UserSummary {
  id: string;
  full_name: string;
  email?: string;
  role: string;
  barangay?: string;
  registration_completed_at?: string | null;
  created_at?: string;
}

export const LGU_ASSIGNABLE_ROLE_LABELS: Record<string, string> = {
  lgu_admin: 'LGU admin',
  lgu_staff: 'LGU staff',
  field_worker: 'Field worker',
  field_checker: 'Field checker (dispatch)',
  citizen: 'Community member (remove LGU access)',
};
