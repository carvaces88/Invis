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
  joonas: { email: 'joonas@invis.app', displayName: 'Joonas', role: 'guest' },
  heidi: { email: 'heidi@invis.app', displayName: 'Heidi', role: 'guest' },
  patricio: {
    email: 'patricio@invis.app',
    displayName: 'Patricio',
    role: 'guest',
  },
  investor: {
    email: 'investor@invis.app',
    displayName: 'Investor',
    role: 'guest',
  },
};

export const KITCHEN_NAMES = ['cesar', 'elena', 'ivan', 'guest'] as const;

/**
 * Named beta testers — cloud sync via canonical account email.
 * Venue ownership (authoritative):
 * - joonas → Ravintola Lonkka
 * - jani → Kamppi · Kulturikasarmi
 * - patricio → Daily Dose
 * - heidi → Fair Buffet · Messukeskus (sample inventory + Pro)
 */
export const BETA_TESTER_NAMES = ['jani', 'joonas', 'patricio', 'heidi'] as const;

/** Canonical venue / site label per beta gate name (lowercase key). */
export const BETA_DEFAULT_VENUE: Record<
  (typeof BETA_TESTER_NAMES)[number],
  string
> = {
  joonas: 'Ravintola Lonkka',
  jani: 'Kamppi · Kulturikasarmi',
  patricio: 'Daily Dose',
  heidi: 'Fair Buffet · Messukeskus',
};

/** Investor walkthrough — full app + Pro unlock + pitch deck */
export const INVESTOR_NAMES = ['investor'] as const;

/** Pro unlocks (video walkthrough, etc.) — investors + selected pilots */
export const PRO_NAMES = ['investor', 'heidi'] as const;

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

/** Canonical restaurant for a known beta tester, or null. */
export function defaultVenueForName(raw: string): string | null {
  const key = normalizeGateName(raw).toLowerCase();
  if ((BETA_TESTER_NAMES as readonly string[]).includes(key)) {
    return BETA_DEFAULT_VENUE[key as (typeof BETA_TESTER_NAMES)[number]];
  }
  return null;
}

export function isInvestorName(raw: string): boolean {
  const key = normalizeGateName(raw).toLowerCase();
  return (INVESTOR_NAMES as readonly string[]).includes(key);
}

export function isProName(raw: string): boolean {
  const key = normalizeGateName(raw).toLowerCase();
  return (PRO_NAMES as readonly string[]).includes(key);
}

/** Skip email/venue on the welcome gate */
export function isGateBypassName(raw: string): boolean {
  return isKitchenName(raw) || isBetaTesterName(raw) || isInvestorName(raw);
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

/** Email used for Supabase workspace_snapshots — gate email or known account alias. */
export function resolveSyncEmail(session: {
  name: string;
  email: string | null;
}): string | null {
  const fromSession = session.email?.trim().toLowerCase();
  if (fromSession) return fromSession;
  const account = resolveAuthAccount(session.name);
  return account?.email?.trim().toLowerCase() ?? null;
}
