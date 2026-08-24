/** Allowed kitchen password logins — username (any case) → auth email */
export const AUTH_ACCOUNTS: Record<
  string,
  { email: string; displayName: string; role: 'admin' | 'guest' }
> = {
  cesar: { email: 'cesar@invis.app', displayName: 'Cesar', role: 'admin' },
  elena: { email: 'elena@invis.app', displayName: 'Elena', role: 'admin' },
  ivan: { email: 'ivan@invis.app', displayName: 'Ivan', role: 'admin' },
  guest: { email: 'guest@invis.app', displayName: 'Guest', role: 'guest' },
};

export const KITCHEN_NAMES = ['cesar', 'elena', 'ivan', 'guest'] as const;

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
