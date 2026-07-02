export type AttendanceStatus =
  | 'registered'
  | 'checked-in'
  | 'checked-out'
  | 'verified'
  | 'rejected';

export type TrackerStatus = 'registered' | 'checked-in' | 'completed' | 'rejected';

export interface AttendanceEventOption {
  id: string;
  title: string;
  barangay?: string;
  scheduled_start: string;
  scheduled_end: string;
  approval_status: string;
  total_volunteers: number;
  total_verified_hours: number;
  by_status: Record<string, number>;
  by_tracker_status?: Record<TrackerStatus, number>;
}

export interface VolunteerAttendance {
  user_id: string;
  attendance_id: string;
  full_name: string;
  barangay?: string;
  phone_number?: string;
  emergency_contact?: string;
  email?: string;
  organizer_status: AttendanceStatus;
  lgu_status: AttendanceStatus;
  tracker_status: TrackerStatus;
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
  certificate_sent_at?: string;
  certificate_sent_to?: string;
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
    auto_send_certificates?: boolean;
  };
  permissions: {
    can_view_pii: boolean;
    can_organizer_verify: boolean;
    can_lgu_verify: boolean;
    can_send_certificate: boolean;
  };
  summary: {
    total_volunteers: number;
    by_status: Record<string, number>;
    by_tracker_status?: Record<TrackerStatus, number>;
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

export interface CertificateSendResult {
  user_id: string;
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  email?: string;
  certificate_sent_at?: string;
  mode?: string;
}

export interface BatchCertificateSendResult {
  event_id: string;
  sent_count: number;
  skipped_count: number;
  sent: CertificateSendResult[];
  skipped: CertificateSendResult[];
}
