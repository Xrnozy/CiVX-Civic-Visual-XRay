/** Derived cleanup event lifecycle — no separate DB status enum for ongoing/ended. */

export function isEventEnded(scheduledEnd?: string | null): boolean {
  if (!scheduledEnd) return false;
  return new Date(scheduledEnd).getTime() <= Date.now();
}

export function isEventStarted(scheduledStart?: string | null): boolean {
  if (!scheduledStart) return true;
  return new Date(scheduledStart).getTime() <= Date.now();
}

export function isEventOngoing(event: {
  approval_status: string;
  scheduled_end?: string | null;
  checkout_qr_code_token?: string | null;
}): boolean {
  return (
    event.approval_status === 'approved' &&
    !event.checkout_qr_code_token &&
    !isEventEnded(event.scheduled_end)
  );
}

export type AttendanceQrMode = 'check-in' | 'check-out';

export type EventAttendancePhase = 'unavailable' | 'before_start' | 'checkin' | 'checkout';

export function getEventAttendancePhase(event: {
  approval_status: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  checkout_qr_code_token?: string | null;
}): EventAttendancePhase {
  if (event.approval_status !== 'approved') return 'unavailable';
  if (event.checkout_qr_code_token) return 'checkout';
  if (!isEventStarted(event.scheduled_start)) return 'before_start';
  if (isEventEnded(event.scheduled_end)) return 'unavailable';
  return 'checkin';
}

export function canOrganizerEndEvent(event: {
  approval_status: string;
  scheduled_start?: string | null;
  checkout_qr_code_token?: string | null;
}): boolean {
  return (
    event.approval_status === 'approved' &&
    !event.checkout_qr_code_token &&
    isEventStarted(event.scheduled_start)
  );
}

export function checkInUrl(eventId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/check-in/${eventId}`;
  }
  return `/check-in/${eventId}`;
}

export function checkOutUrl(eventId: string, token: string): string {
  const encoded = encodeURIComponent(token);
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/check-out/${eventId}?t=${encoded}`;
  }
  return `/check-out/${eventId}?t=${encoded}`;
}
