/**
 * Unified product name display for sheets / catalog UI.
 * Lowercase everything, then capitalize the first letter of each word
 * (Finnish locale) so OCR ALL CAPS / mixed case read normally.
 */
export function formatProductDisplayName(raw: string): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  const lower = trimmed.toLocaleLowerCase('fi-FI');
  // Separators only — do NOT put `-` between two chars (that makes a range).
  return lower.replace(
    /(^|[\s/()]|[-–—])(\S)/g,
    (_m, sep: string, ch: string) =>
      `${sep}${ch.toLocaleUpperCase('fi-FI')}`,
  );
}
