/**
 * 150-cover Finnish kitchen event menu seed:
 * Skagen toast · lohikeitto · tiramisu
 *
 * Prices: K-Ruoka-style unitPriceAlv0 (shelf € ÷ 1.14 food ALV) — seeded
 * estimates when live SKU not yet in seedKruoka. Quantities include ~10% buffer.
 */
import type { Product } from './types';
import {
  DEFAULT_PLACE_ID,
  SEED_PLACES,
} from './seedPlaces';

/** Preferred storage place for event mise (overrides default place for seed qty). */
export const EVENT_PRODUCT_PLACE: Record<string, string> = {
  // Freezer
  'kruoka-menu-kuoritut-katkaravut-1kg': 'place-freezer-1',
  'rr-kirjolohi-fil': 'place-freezer-1',
  // Prep fridge (fresh / dairy / chilled)
  'kruoka-herkkumaa-taysmajoneesi-5kg': 'place-prep-fridge',
  'buffet-majoneesi': 'place-prep-fridge',
  'rr-smetana': 'place-prep-fridge',
  'buffet-tillia': 'place-prep-fridge',
  'kruoka-pirkka-sitruuna-luomu': 'place-prep-fridge',
  'buffet-sitruuna': 'place-prep-fridge',
  'kruoka-punasipuli': 'place-prep-fridge',
  'rr-kirjolohen-mati': 'place-prep-fridge',
  'buffet-voi': 'place-prep-fridge',
  'buffet-kerma': 'place-prep-fridge',
  'kruoka-purjo': 'place-prep-fridge',
  'kruoka-pirkka-pesty-porkkana-1kg': 'place-prep-fridge',
  'buffet-kananmunat': 'place-prep-fridge',
  'kruoka-valio-mascarpone-250g': 'place-prep-fridge',
  'rr-tuorejuusto-menu': 'place-prep-fridge',
  'buffet-maito': 'place-prep-fridge',
  // Dry storage
  'buffet-voileipaleipa': 'place-upstairs',
  'buffet-peruna': 'place-upstairs',
  'buffet-sipuli': 'place-upstairs',
  'buffet-kasvisliemi': 'place-upstairs',
  'kruoka-knorr-kalaliemi-75g': 'place-upstairs',
  'sokeri-menu': 'place-upstairs',
  tomusokeri: 'place-upstairs',
  'rr-savoijard-keksi': 'place-upstairs',
  'kruoka-pirkka-kaakaojauhe-200g': 'place-upstairs',
  'kruoka-pirkka-espresso-250g': 'place-upstairs',
  'figaro-kapris': 'place-upstairs',
  // Drawers (spices)
  'kruoka-pirkka-suola-1kg': 'place-drawers',
  'kruoka-pirkka-mustapippuri-21g': 'place-drawers',
};

/**
 * Extra / missing K-Ruoka-style SKUs for the event (0% ALV).
 * Prefer real retail naming; prices ≈ shelf÷1.14.
 */
export const SEED_EVENT_PRODUCTS: Product[] = [
  {
    id: 'kruoka-menu-kuoritut-katkaravut-1kg',
    officialName: 'Menu kuoritut katkaravut 1 kg',
    unit: 'KG',
    packSize: '1 kg',
    unitPriceAlv0: 15.7, // ~17.90 € shelf
    ingredientType: 'frozen',
    section: 'K-Ruoka · seafood',
    aliases: [
      'katkarapu',
      'kuoritut katkaravut',
      'peeled shrimp',
      'shrimp',
      'prawns',
      'skagen shrimp',
      'menu katkarapu',
    ],
  },
  {
    id: 'kruoka-punasipuli',
    officialName: 'Punasipuli',
    unit: 'KG',
    unitPriceAlv0: 1.75, // ~2.00 €/kg shelf
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: ['red onion', 'punasipuli', 'rödlök'],
  },
  {
    id: 'kruoka-purjo',
    officialName: 'Purjo',
    unit: 'KG',
    unitPriceAlv0: 2.63, // ~3.00 €/kg shelf
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: ['leek', 'purjo', 'purjosipuli'],
  },
  {
    id: 'kruoka-valio-mascarpone-250g',
    officialName: 'Valio mascarpone 250 g',
    unit: 'KPL',
    packSize: '250 g',
    unitPriceAlv0: 2.19, // ~2.49 € shelf
    ingredientType: 'dairy',
    section: 'K-Ruoka · dairy',
    aliases: ['mascarpone', 'valio mascarpone', 'tiramisu cheese'],
  },
  {
    id: 'kruoka-pirkka-kaakaojauhe-200g',
    officialName: 'Pirkka kaakaojauhe 200 g',
    unit: 'PSS',
    packSize: '200 g',
    unitPriceAlv0: 1.75, // ~2.00 € shelf
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · dry',
    aliases: ['kaakaojauhe', 'cocoa powder', 'cocoa', 'kaakao', 'pirkka kaakao'],
  },
  {
    id: 'kruoka-pirkka-espresso-250g',
    officialName: 'Pirkka espresso jauhettu 250 g',
    unit: 'PSS',
    packSize: '250 g',
    unitPriceAlv0: 3.42, // ~3.90 € shelf
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · dry',
    aliases: [
      'espresso',
      'pirkka espresso',
      'jauhettu kahvi',
      'coffee',
      'kahvi espresso',
      'tiramisu coffee',
    ],
  },
  {
    id: 'kruoka-knorr-kalaliemi-75g',
    officialName: 'Knorr kalaliemikuutio 75 g',
    unit: 'PKT',
    packSize: '75 g',
    unitPriceAlv0: 1.84, // ~2.10 € shelf
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · dry',
    aliases: [
      'kalaliemi',
      'fish stock',
      'knorr kalaliemi',
      'fish bouillon',
      'kalaliemikuutio',
    ],
  },
];

/**
 * Opening stock sized for 150 covers + ~10% buffer.
 * Merged last into SEED_QTY so it wins over demo random inventaariopohja qtys.
 */
export const EVENT_SEED_QTY: Record<string, number> = {
  // Skagen
  'kruoka-menu-kuoritut-katkaravut-1kg': 8, // 7.5 kg need
  'kruoka-herkkumaa-taysmajoneesi-5kg': 2,
  'buffet-majoneesi': 4,
  'rr-smetana': 15, // ~200 g RAS → ~3 kg
  'buffet-tillia': 24,
  'kruoka-pirkka-sitruuna-luomu': 30,
  'buffet-sitruuna': 4,
  'kruoka-punasipuli': 1.2,
  'rr-kirjolohen-mati': 10, // garnish RAS
  'buffet-voileipaleipa': 12,
  'buffet-voi': 4,
  'figaro-kapris': 2,
  // Lohikeitto
  'rr-kirjolohi-fil': 16,
  'buffet-peruna': 30,
  'buffet-sipuli': 10,
  'kruoka-purjo': 5.5,
  'kruoka-pirkka-pesty-porkkana-1kg': 10,
  'buffet-kerma': 14,
  'buffet-kasvisliemi': 2,
  'kruoka-knorr-kalaliemi-75g': 8,
  // Tiramisu
  'buffet-kananmunat': 100,
  'kruoka-valio-mascarpone-250g': 28, // 7 kg
  'rr-tuorejuusto-menu': 2,
  'sokeri-menu': 5,
  tomusokeri: 5,
  'rr-savoijard-keksi': 24, // ~200 g packs
  'kruoka-pirkka-kaakaojauhe-200g': 4,
  'kruoka-pirkka-espresso-250g': 4,
  'buffet-maito': 8,
  // Seasoning
  'kruoka-pirkka-suola-1kg': 2,
  'kruoka-pirkka-mustapippuri-21g': 3,
};

/** Storage type label for docs / inventory tables (from preferred place). */
export function eventStorageTypeForProduct(
  productId: string,
): 'dry_storage' | 'freezer' | 'prep_fridge' | 'drawers' {
  const placeId = EVENT_PRODUCT_PLACE[productId] ?? DEFAULT_PLACE_ID;
  const place = SEED_PLACES.find((p) => p.id === placeId);
  return place?.storageType ?? 'prep_fridge';
}
