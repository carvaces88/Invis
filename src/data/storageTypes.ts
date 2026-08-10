import type { Place, PlaceKind, StorageType } from './types';

export const STORAGE_TYPES: StorageType[] = [
  'dry_storage',
  'freezer',
  'prep_fridge',
  'drawers',
];

/** Map legacy PlaceKind → StorageType when storageType is unset */
export function storageTypeFromKind(kind?: PlaceKind): StorageType {
  switch (kind) {
    case 'freezer':
      return 'freezer';
    case 'pantry':
      return 'dry_storage';
    case 'kitchen':
      return 'prep_fridge';
    default:
      return 'dry_storage';
  }
}

export function resolveStorageType(place: Place): StorageType {
  return place.storageType ?? storageTypeFromKind(place.kind);
}

export function isStorageType(v: string): v is StorageType {
  return (STORAGE_TYPES as string[]).includes(v);
}
