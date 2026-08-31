import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISS_KEY = 'invis.monthEndReminderDismissed';

/** Calendar month key YYYY-MM */
export function monthKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function lastDayOfMonth(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Second-to-last calendar day of the month (e.g. 30 in a 31-day month). */
export function secondToLastDayOfMonth(d = new Date()): number {
  return lastDayOfMonth(d) - 1;
}

/**
 * Reminder window: second-to-last day through the last day.
 * Starts on the day the user asked for; keeps showing on the last day
 * if they open the app a day late (until dismissed for that month).
 */
export function isMonthEndReminderWindow(d = new Date()): boolean {
  const day = d.getDate();
  const last = lastDayOfMonth(d);
  return day >= last - 1 && day <= last;
}

export function isSecondToLastDay(d = new Date()): boolean {
  return d.getDate() === secondToLastDayOfMonth(d);
}

export async function wasMonthEndReminderDismissed(
  d = new Date(),
): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(DISMISS_KEY);
    return stored === monthKey(d);
  } catch {
    return false;
  }
}

export async function dismissMonthEndReminder(d = new Date()): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISS_KEY, monthKey(d));
  } catch {
    // ignore
  }
}

export async function shouldShowMonthEndReminder(
  d = new Date(),
): Promise<boolean> {
  if (!isMonthEndReminderWindow(d)) return false;
  return !(await wasMonthEndReminderDismissed(d));
}
