/** Allowed kitchen password logins — username (any case) → auth email */
export const AUTH_ACCOUNTS: Record<
  string,
  { email: string; displayName: string; role: 'admin' | 'guest' }
> = {
  cesar: { email: 'cesar@invis.app', displayName: 'Cesar', role: 'admin' },
  elena: { email: 'elena@invis.app', displayName: 'Elena', role: 'admin' },
  ivan: { email: 'ivan@invis.app', displayName: 'Ivan', role: 'admin' },
  guest: { email: 'guest@invis.app', displayName: 'Guest', role: 'guest' },
  jani: { email: 'jani@invis.app', displayName: 'Jani', role: 'guest' },
};

export const KITCHEN_NAMES = ['cesar', 'elena', 'ivan', 'guest'] as const;

/** Named beta testers — enter without email; get a clean empty inventory workspace */
export const BETA_TESTER_NAMES = ['jani'] as const;

export function resolveAuthAccount(usernameRaw: string) {
  const username = usernameRaw.trim().toLowerCase();
  const account = AUTH_ACCOUNTS[username];
  if (!account) return null;
  return { username, ...account };
}

export function normalizeGateName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isKitchenName(raw: string): boolean {
  const key = normalizeGateName(raw).toLowerCase();
  return (KITCHEN_NAMES as readonly string[]).includes(key);
}

export function isBetaTesterName(raw: string): boolean {
  const key = normalizeGateName(raw).toLowerCase();
  return (BETA_TESTER_NAMES as readonly string[]).includes(key);
}

/** Skip email/venue on the welcome gate */
export function isGateBypassName(raw: string): boolean {
  return isKitchenName(raw) || isBetaTesterName(raw);
}

export function isAdminName(raw: string): boolean {
  const key = normalizeGateName(raw).toLowerCase();
  return key === 'cesar' || key === 'elena' || key === 'ivan';
}

/** Cesar-only master dashboard (orange More button) */
export function isMasterName(raw: string): boolean {
  return normalizeGateName(raw).toLowerCase() === 'cesar';
}

export function displayKitchenName(raw: string): string {
  const account = resolveAuthAccount(raw);
  return account?.displayName ?? normalizeGateName(raw);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(raw.trim());
}
