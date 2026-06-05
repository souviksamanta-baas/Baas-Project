export function normalizeEmail(email: string): string | null {
  const normalizedEmail = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? normalizedEmail : null;
}
