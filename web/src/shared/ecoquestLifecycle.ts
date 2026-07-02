export function ecoquestCheckInUrl(taskId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/ecoquest-check-in/${taskId}`;
  }
  return `/ecoquest-check-in/${taskId}`;
}
