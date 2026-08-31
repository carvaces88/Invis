/**
 * Unified product name display for sheets / catalog UI.
 * Collapses whitespace and applies Finnish title case so ALL CAPS and
 * mixed OCR casing read the same way.
 */
export function formatProductDisplayName(raw: string): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  const lower = trimmed.toLocaleLowerCase('fi-FI');
  return lower.replace(/(^|[\s/([-–—])(\S)/g, (_m, sep: string, ch: string) => {
    return `${sep}${ch.toLocaleUpperCase('fi-FI')}`;
  });
}
