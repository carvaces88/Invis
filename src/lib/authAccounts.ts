/** Allowed kitchen logins — username (any case) → auth email */
export const AUTH_ACCOUNTS: Record<
  string,
  { email: string; displayName: string; role: 'admin' | 'guest' }
> = {
  cesar: { email: 'cesar@invis.app', displayName: 'Cesar', role: 'admin' },
  elena: { email: 'elena@invis.app', displayName: 'Elena', role: 'admin' },
  ivan: { email: 'ivan@invis.app', displayName: 'Ivan', role: 'admin' },
  guest: { email: 'guest@invis.app', displayName: 'Guest', role: 'guest' },
};

export function resolveAuthAccount(usernameRaw: string) {
  const username = usernameRaw.trim().toLowerCase();
  const account = AUTH_ACCOUNTS[username];
  if (!account) return null;
  return { username, ...account };
}
