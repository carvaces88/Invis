import AsyncStorage from '@react-native-async-storage/async-storage';

/** When set, Simple invis (mini) starts with empty lists — no Lönkka demo stock. */
export const SIMP_EMPTY_START_KEY = 'invis.simpCount.emptyStart.v1';

const SIMP_MONTH_STOCK_KEY = 'invis.simpCount.monthStock.v1';
const SIMP_HIDDEN_KEY = 'invis.simpCount.hiddenIds.v1';
const SIMP_EXTRAS_KEY = 'invis.simpCount.extraProducts.v1';

/** Wipe Simple invis demo data so a new tester starts from zero. */
export async function markSimpCountEmptyStart(): Promise<void> {
  await AsyncStorage.multiSet([[SIMP_EMPTY_START_KEY, '1']]);
  await AsyncStorage.multiRemove([
    SIMP_MONTH_STOCK_KEY,
    SIMP_HIDDEN_KEY,
    SIMP_EXTRAS_KEY,
  ]);
}

export async function clearSimpCountEmptyStart(): Promise<void> {
  await AsyncStorage.removeItem(SIMP_EMPTY_START_KEY);
}

export async function isSimpCountEmptyStart(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SIMP_EMPTY_START_KEY)) === '1';
  } catch {
    return false;
  }
}
