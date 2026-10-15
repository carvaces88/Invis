import {
  BETA_TESTER_NAMES,
  defaultVenueForName,
  displayKitchenName,
  isBetaTesterName,
  isInvestorName,
  normalizeGateName,
} from './authAccounts';

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

/**
 * More-screen signed-in meta line.
 * Investor: "Investor · beta 1" (never stale name + trailing Investor venue/role).
 * Named betas: "Jani · beta 1 · Kamppi · Kulturikasarmi" (name · beta n · venue).
 * Others: "site · name" when both set.
 */
export function moreAccountStatusLine(opts: {
  sessionName?: string | null;
  displayName?: string | null;
  siteName?: string | null;
}): string {
  const raw = (opts.sessionName ?? opts.displayName ?? '').trim();
  const display = kitchenUserLabel(
    raw ? displayKitchenName(raw) : opts.displayName,
  );
  const site = kitchenLocationLabel(opts.siteName);

  if (raw && isInvestorName(raw)) {
    return 'Investor · beta 1';
  }

  if (raw && isBetaTesterName(raw)) {
    const key = normalizeGateName(raw).toLowerCase();
    const idx = (BETA_TESTER_NAMES as readonly string[]).indexOf(key);
    const betaN = idx >= 0 ? idx + 1 : 1;
    const venue = defaultVenueForName(raw) || site;
    const name = display || displayKitchenName(raw);
    return venue ? `${name} · beta ${betaN} · ${venue}` : `${name} · beta ${betaN}`;
  }

  if (site && display) return `${site} · ${display}`;
  return site || display;
}
