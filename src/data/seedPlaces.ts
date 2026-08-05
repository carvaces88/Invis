import type { Place } from './types';

/** Demo site label — user-renameable (e.g. Kamppi) */
export const SEED_SITE_NAME = 'Kamppi';

/**
 * Kamppi-style demo storages. First place is the default for seed stock
 * and new counts when no place is selected.
 */
export const SEED_PLACES: Place[] = [
  {
    id: 'place-downstairs',
    name: 'Downstairs kitchen',
    kind: 'kitchen',
    sortOrder: 0,
  },
  {
    id: 'place-upstairs',
    name: 'Upstairs catering kitchen',
    kind: 'kitchen',
    sortOrder: 1,
  },
  {
    id: 'place-freezer-1',
    name: 'Freezer 1',
    kind: 'freezer',
    sortOrder: 2,
  },
  {
    id: 'place-freezer-2',
    name: 'Freezer 2',
    kind: 'freezer',
    sortOrder: 3,
  },
];

export const DEFAULT_PLACE_ID = SEED_PLACES[0]!.id;
