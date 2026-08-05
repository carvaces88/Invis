import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_EXPORT_PROFILE,
  type ExportProfileId,
} from './profiles';

const STORAGE_KEY = 'invis.inventoryViewProfile';

const VALID: ExportProfileId[] = [
  'amounts',
  'withPrice',
  'nameQty',
  'restolution',
];

function isProfileId(value: string | null): value is ExportProfileId {
  return value != null && (VALID as string[]).includes(value);
}

/** Last on-screen spreadsheet column profile (Home → Inventory). */
export async function loadViewProfile(): Promise<ExportProfileId> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isProfileId(stored)) return stored;
  } catch {
    // keep default
  }
  return DEFAULT_EXPORT_PROFILE;
}

export async function saveViewProfile(
  id: ExportProfileId,
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore persistence errors
  }
}
