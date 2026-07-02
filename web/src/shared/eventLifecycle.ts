/** Derived cleanup event lifecycle — no separate DB status enum for ongoing/ended. */

export function isEventEnded(scheduledEnd?: string | null): boolean {
  if (!scheduledEnd) return false;
  return new Date(scheduledEnd).getTime() <= Date.now();
}

export function isEventOngoing(event: {
  approval_status: string;
  scheduled_end?: string | null;
}): boolean {
  return event.approval_status === 'approved' && !isEventEnded(event.scheduled_end);
}

export function checkInUrl(eventId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/check-in/${eventId}`;
  }
  return `/check-in/${eventId}`;
}
