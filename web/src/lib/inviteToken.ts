/** Extract invite token from a QR payload (raw token or register URL). */
export function parseInviteToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const invite = url.searchParams.get('invite');
    if (invite) return invite;
  } catch {
    /* plain token */
  }

  return trimmed;
}
