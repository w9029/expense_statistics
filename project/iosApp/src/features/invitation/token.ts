export function normalizeInvitationToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? trimmed;
  } catch {
    const segments = trimmed.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? trimmed;
  }
}
