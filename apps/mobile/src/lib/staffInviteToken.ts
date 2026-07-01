export function parseStaffInviteToken(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.searchParams.get('token');
  } catch {
    return value.trim();
  }
}
