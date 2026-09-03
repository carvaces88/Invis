import type { Place } from './types';

/** Demo site label — user-renameable (e.g. Kamppi) */
export const SEED_SITE_NAME = 'Kamppi';

/**
 * Kamppi-style demo storages. First place is the default for seed stock
 * and new counts when no place is selected.
 *
 * storageType drives Inventory tab filter (dry / freezer / prep / drawers).
 */
export const SEED_PLACES: Place[] = [
  {
    id: 'place-downstairs',
    name: 'Downstairs kitchen',
    kind: 'kitchen',
    storageType: 'prep_fridge',
    sortOrder: 0,
  },
  {
    id: 'place-upstairs',
    name: 'Upstairs catering kitchen',
    kind: 'kitchen',
    storageType: 'dry_storage',
    sortOrder: 1,
  },
  {
    id: 'place-freezer-1',
    name: 'Freezer 1',
    kind: 'freezer',
    storageType: 'freezer',
    sortOrder: 2,
  },
  {
    id: 'place-freezer-2',
    name: 'Freezer 2',
    kind: 'freezer',
    storageType: 'freezer',
    sortOrder: 3,
  },
  {
    id: 'place-prep-fridge',
    name: 'Prep fridge',
    kind: 'kitchen',
    storageType: 'prep_fridge',
    sortOrder: 4,
  },
  {
    id: 'place-drawers',
    name: 'Drawers',
    kind: 'other',
    storageType: 'drawers',
    sortOrder: 5,
  },
];

export const DEFAULT_PLACE_ID = SEED_PLACES[0]!.id;

/** Ravintola Lonkka (Joonas) — start with one fridge + one freezer; editable in Places */
export const LONKKA_SITE_NAME = 'Ravintola Lonkka';

export const LONKKA_SEED_PLACES: Place[] = [
  {
    id: 'place-lonkka-fridge',
    name: 'Fridge',
    kind: 'kitchen',
    storageType: 'prep_fridge',
    sortOrder: 0,
  },
  {
    id: 'place-lonkka-freezer',
    name: 'Freezer',
    kind: 'freezer',
    storageType: 'freezer',
    sortOrder: 1,
  },
];
