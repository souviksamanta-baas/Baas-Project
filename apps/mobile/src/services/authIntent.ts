/** Remember why the user opened login (create business vs returning sign-in). */
export type AuthEntryIntent = 'create' | 'signin';

let entryIntent: AuthEntryIntent | null = null;

export function setAuthEntryIntent(intent: AuthEntryIntent | null): void {
  entryIntent = intent;
}

export function getAuthEntryIntent(): AuthEntryIntent | null {
  return entryIntent;
}

export function clearAuthEntryIntent(): void {
  entryIntent = null;
}
