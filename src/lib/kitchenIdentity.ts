/**
 * Location + user labels for normal Invis and Mini Invis headers
 * when a kitchen (venue / site) is registered on the welcome gate.
 */
export function kitchenLocationLabel(siteName: string | null | undefined): string {
  return (siteName ?? '').trim();
}

export function kitchenUserLabel(displayName: string | null | undefined): string {
  return (displayName ?? '').trim();
}

/** e.g. "Ravintola Lonkka · Joonas" — empty string if neither set. */
export function kitchenIdentityTitle(opts: {
  siteName?: string | null;
  displayName?: string | null;
}): string {
  const location = kitchenLocationLabel(opts.siteName);
  const user = kitchenUserLabel(opts.displayName);
  if (location && user) return `${location} · ${user}`;
  return location || user;
}
