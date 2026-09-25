import AsyncStorage from '@react-native-async-storage/async-storage';

/** Normalize gate name / email into a stable Mini Invis workspace id. */
export function simpCountOwnerKey(
  nameOrEmail: string | null | undefined,
): string {
  const raw = (nameOrEmail ?? '').trim().toLowerCase();
  return raw || 'anon';
}

export function simpCountStorageKeys(ownerKey: string) {
  const o = simpCountOwnerKey(ownerKey);
  return {
    hidden: `invis.simpCount.hiddenIds.${o}.v1`,
    extras: `invis.simpCount.extraProducts.${o}.v1`,
    emptyStart: `invis.simpCount.emptyStart.${o}.v1`,
    monthStock: `invis.simpCount.monthStock.${o}.v1`,
  };
}

/** Legacy global keys (pre–per-user) — only cleared, never shared across users. */
export const SIMP_LEGACY_KEYS = [
  'invis.simpCount.hiddenIds.v1',
  'invis.simpCount.extraProducts.v1',
  'invis.simpCount.emptyStart.v1',
  'invis.simpCount.monthStock.v1',
] as const;

/** Wipe Mini Invis for this owner so they start empty (no shared demo sheet). */
export async function markSimpCountEmptyStart(
  ownerKey: string,
): Promise<void> {
  const keys = simpCountStorageKeys(ownerKey);
  await AsyncStorage.multiSet([[keys.emptyStart, '1']]);
  await AsyncStorage.multiRemove([
    keys.monthStock,
    keys.hidden,
    keys.extras,
  ]);
}

export async function clearSimpCountEmptyStart(
  ownerKey: string,
): Promise<void> {
  const keys = simpCountStorageKeys(ownerKey);
  await AsyncStorage.removeItem(keys.emptyStart);
}

export async function isSimpCountEmptyStart(
  ownerKey: string,
): Promise<boolean> {
  try {
    const keys = simpCountStorageKeys(ownerKey);
    return (await AsyncStorage.getItem(keys.emptyStart)) === '1';
  } catch {
    return false;
  }
}

/** Drop legacy global Mini Invis keys so they cannot leak between users. */
export async function clearLegacySimpCountGlobals(): Promise<void> {
  await AsyncStorage.multiRemove([...SIMP_LEGACY_KEYS]);
}
