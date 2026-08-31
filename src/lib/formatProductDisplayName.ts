/**
 * Unified product name display for sheets / catalog UI.
 * Collapses whitespace, lowercases, then capitalizes the first letter of each
 * word (Finnish locale) so OCR ALL CAPS / mixed case read normally.
 *
 * Note: hyphens in the separator class must stay at the end (or be escaped) —
 * a mid-class `-` becomes a character range and mangled casing (e.g. DiGeStIvE).
 */
export function formatProductDisplayName(raw: string): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  const lower = trimmed.toLocaleLowerCase('fi-FI');
  // Word starts: start of string, space, slash, open paren, hyphen/dash
  return lower.replace(
    /(^|[\s/(-–—])(\S)/g,
    (_m, sep: string, ch: string) =>
      `${sep}${ch.toLocaleUpperCase('fi-FI')}`,
  );
}
