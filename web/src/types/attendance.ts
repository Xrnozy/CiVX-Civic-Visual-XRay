export type AttendanceStatus =
  | 'registered'
  | 'checked-in'
  | 'checked-out'
  | 'verified'
  | 'rejected';

export interface AttendanceEventOption {
  id: string;
  title: string;
  barangay?: string;
  scheduled_start: string;
  scheduled_end: string;
  approval_status: string;
  total_volunteers: number;
  total_verified_hours: number;
  by_status: Record<AttendanceStatus, number>;
}

export interface VolunteerAttendance {
  user_id: string;
  attendance_id: string;
  full_name: string;
  barangay?: string;
  phone_number?: string;
  emergency_contact?: string;
  organizer_status: AttendanceStatus;
  lgu_status: AttendanceStatus;
  check_in_time?: string;
  check_out_time?: string;
  check_in_latitude?: number;
  check_in_longitude?: number;
  gps_valid?: boolean | null;
  qr_valid?: boolean | null;
  selfie_url?: string;
  calculated_hours: number;
  verified_hours: number;
  registered_at?: string;
}

export interface EventRoster {
  event: {
    id: string;
    title: string;
    barangay?: string;
    scheduled_start: string;
    scheduled_end: string;
    approval_status: string;
    organizer_user_id: string;
  };
  permissions: {
    can_view_pii: boolean;
    can_organizer_verify: boolean;
    can_lgu_verify: boolean;
  };
  summary: {
    total_volunteers: number;
    by_status: Record<AttendanceStatus, number>;
    checked_in_percent: number;
    total_verified_hours: number;
  };
  volunteers: VolunteerAttendance[];
}

export interface ServiceCertificate {
  record: {
    volunteer_name: string;
    event_title: string;
    event_id: string;
    barangay?: string;
    service_hours: number;
    check_in_time?: string;
    check_out_time?: string;
    verified_by: string;
    verified_status: AttendanceStatus;
  };
  html: string;
}
