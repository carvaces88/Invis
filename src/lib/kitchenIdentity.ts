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

/** Stale More-meta fragments sometimes leak into siteName (e.g. "Jani · beta 1"). */
function looksLikeBetaStatusFragment(site: string): boolean {
  return /\bbeta\s*\d+\b/i.test(site);
}

function resolveAccountRaw(opts: {
  sessionName?: string | null;
  displayName?: string | null;
}): string {
  // Prefer || so empty string does not block displayName / username fallbacks.
  return (opts.sessionName || opts.displayName || '').trim();
}

function isInvestorAccount(opts: {
  sessionName?: string | null;
  displayName?: string | null;
  isInvestor?: boolean;
}): boolean {
  if (opts.isInvestor) return true;
  if (isInvestorName(opts.sessionName ?? '')) return true;
  if (isInvestorName(opts.displayName ?? '')) return true;
  return false;
}

/** e.g. "Ravintola Lonkka · Joonas" — empty string if neither set. */
export function kitchenIdentityTitle(opts: {
  siteName?: string | null;
  displayName?: string | null;
  sessionName?: string | null;
  isInvestor?: boolean;
}): string {
  const user = kitchenUserLabel(
    opts.displayName ||
      (opts.sessionName ? displayKitchenName(opts.sessionName) : ''),
  );

  if (isInvestorAccount(opts)) {
    // Venue already carries "Investor"; never mash a stale name into the title.
    const canonical = defaultVenueForName('investor');
    return canonical || user || 'Investor';
  }

  let location = kitchenLocationLabel(opts.siteName);
  if (location && looksLikeBetaStatusFragment(location)) {
    const fromName = opts.sessionName || opts.displayName;
    location = (fromName && defaultVenueForName(fromName)) || '';
  }

  if (location && user) {
    // Avoid "Investor demo · … · Investor" style doubling when site already names the user.
    if (location.toLowerCase().includes(user.toLowerCase())) return location;
    return `${location} · ${user}`;
  }
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
  /** Auth flag — wins when sessionName is briefly empty/stale after switch. */
  isInvestor?: boolean;
}): string {
  const raw = resolveAccountRaw(opts);
  const display = kitchenUserLabel(
    raw ? displayKitchenName(raw) : opts.displayName,
  );
  let site = kitchenLocationLabel(opts.siteName);

  if (isInvestorAccount(opts) || (raw && isInvestorName(raw))) {
    return 'Investor · beta 1';
  }

  // Never glue a leaked beta-status siteName onto another account's display name.
  if (site && looksLikeBetaStatusFragment(site)) {
    site = (raw && defaultVenueForName(raw)) || '';
  }

  if (raw && isBetaTesterName(raw)) {
    const key = normalizeGateName(raw).toLowerCase();
    const idx = (BETA_TESTER_NAMES as readonly string[]).indexOf(key);
    const betaN = idx >= 0 ? idx + 1 : 1;
    const venue = defaultVenueForName(raw) || site;
    const name = display || displayKitchenName(raw);
    return venue ? `${name} · beta ${betaN} · ${venue}` : `${name} · beta ${betaN}`;
  }

  if (site && display) {
    if (site.toLowerCase().includes(display.toLowerCase())) return site;
    return `${site} · ${display}`;
  }
  return site || display;
}
