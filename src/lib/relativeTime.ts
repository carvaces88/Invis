/** Format an ISO timestamp for inventory “last updated” UI. */
export function formatClockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Short relative / clock label.
 * EN: "Updated 14:32" or "Updated 3 min ago"
 * FI: "Päivitetty 14:32" / "Päivitetty 3 min sitten"
 */
export function formatUpdatedLabel(
  iso: string | undefined,
  locale: 'en' | 'fi',
  nowMs: number = Date.now(),
): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMin = Math.max(0, Math.round((nowMs - then) / 60_000));
  const clock = formatClockTime(iso);
  if (diffMin < 1) {
    return locale === 'fi' ? 'Päivitetty juuri' : 'Updated just now';
  }
  if (diffMin < 60) {
    return locale === 'fi'
      ? `Päivitetty ${diffMin} min sitten`
      : `Updated ${diffMin} min ago`;
  }
  return locale === 'fi' ? `Päivitetty ${clock}` : `Updated ${clock}`;
}

export function minutesSince(iso: string, nowMs: number = Date.now()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.max(0, (nowMs - then) / 60_000);
}
