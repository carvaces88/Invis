import type { Product } from './types';
import {
  BUFFET_SEED_QTY,
  SEED_BUFFET_INGREDIENTS,
  SEED_MEAT_POULTRY,
} from './seedBuffet';
import {
  EVENT_PRODUCT_PLACE,
  EVENT_SEED_QTY,
  SEED_EVENT_PRODUCTS,
} from './seedEventMenu';
import {
  INVENTAARIOPOHJA_SEED_QTY,
  SEED_INVENTAARIOPOHJA_PRODUCTS,
} from './seedInventaariopohja';
import { KRUOKA_SEED_QTY, SEED_KRUOKA_PRODUCTS } from './seedKruoka';
import { DEFAULT_PLACE_ID, SEED_PLACES } from './seedPlaces';

/**
 * Seeded from client inventaariopohja (RR) + Figaro kapris alias demo
 * + K-Ruoka meat/poultry + buffet mise for ~150 covers
 * + K-Ruoka public sauce + retail grocery SKUs (see seedKruoka.ts)
 * + extra inventaariopohja sheet lines (see seedInventaariopohja.ts).
 * Display names: sentence style (first letter caps, Finnish åäö preserved);
 * brands title-cased when multi-word. Aliases stay lowercase for search.
 */
export const SEED_PRODUCTS: Product[] = [
  {
    id: 'figaro-kapris',
    officialName: 'Figaro Kapris etikkaliemessä 935g/600g',
    unit: 'PRK',
    packSize: '935g/600g',
    unitPriceAlv0: 4.2,
    ingredientType: 'canned',
    section: 'Top products',
    isTop: true,
    lowStockThreshold: 2,
    aliases: [
      'kapris',
      'capers',
      'figaro kapris',
      'kapris etikkaliemessä',
      'figaro',
      'caper',
      'kapriksia',
    ],
  },
  {
    id: 'mustah-bonne',
    officialName: 'Mustah Bonne',
    unit: 'L',
    unitPriceAlv0: 4.84,
    ingredientType: 'other',
    section: 'Top products',
    isTop: true,
    aliases: ['mustah', 'bonne', 'mustah bonne'],
  },
  {
    id: 'vaahterasiirappi',
    officialName: 'Vaahterasiirappi',
    unit: 'KPL',
    unitPriceAlv0: 8.5,
    ingredientType: 'sauces',
    section: 'Top products',
    isTop: true,
    aliases: ['maple syrup', 'vaahtera', 'siirappi', 'maple'],
  },
  {
    id: 'polenta',
    officialName: 'Polenta 2,5 kg',
    unit: 'KPL',
    packSize: '2,5 kg',
    unitPriceAlv0: 6.2,
    ingredientType: 'dry_goods',
    section: 'Top products',
    isTop: true,
    aliases: ['polenta', 'maissijauho'],
  },
  {
    id: 'kikherne',
    officialName: 'Kikherne',
    unit: 'PRK',
    unitPriceAlv0: 1.45,
    ingredientType: 'canned',
    section: 'Top products',
    isTop: true,
    aliases: ['chickpeas', 'chickpea', 'garbanzo', 'kikherneet'],
  },
  {
    id: 'pizza-kast',
    officialName: 'Pizza kast',
    unit: 'PRK',
    unitPriceAlv0: 2.1,
    ingredientType: 'sauces',
    section: 'Top products',
    isTop: true,
    aliases: ['pizza sauce', 'pizzakastike', 'tomato sauce pizza'],
  },
  {
    id: 'korean-bbq',
    officialName: 'Korean BBQ menj',
    unit: 'PL',
    packSize: '6x1L',
    unitsPerPack: 6,
    packBaseUnit: 'PL',
    unitPriceAlv0: 5.9,
    ingredientType: 'sauces',
    section: 'Top products',
    isTop: true,
    aliases: ['korean bbq', 'bbq sauce', 'korean barbecue'],
  },
  {
    id: 'pirkka-macarons',
    officialName: 'Pirkka macarons',
    unit: 'RSA',
    unitsPerPack: 12,
    packBaseUnit: 'KPL',
    unitPriceAlv0: 3.5,
    ingredientType: 'bakery',
    aliases: ['macarons', 'macaron', 'pirkka'],
  },
  {
    id: 'pekaanipahkina',
    officialName: 'Pekaanipähkinä 700g',
    unit: 'PSS',
    packSize: '700g',
    unitPriceAlv0: 12.4,
    ingredientType: 'nuts_seeds',
    aliases: ['pecan', 'pecans', 'pekaani', 'pekaanipähkinä', 'pekaanipahkina'],
  },
  {
    id: 'tumma-suklaa',
    officialName: 'Tumma suklaa',
    unit: 'PSS',
    unitsPerPack: 10,
    packBaseUnit: 'KPL',
    unitPriceAlv0: 4.8,
    ingredientType: 'dry_goods',
    aliases: ['dark chocolate', 'suklaa', 'chocolate', 'tumma'],
  },
  {
    id: 'sitruunavinegretti',
    officialName: 'Sitruunavinegretti',
    unit: 'PLO',
    packSize: '6x500ml',
    unitsPerPack: 6,
    packBaseUnit: 'PLO',
    unitPriceAlv0: 3.2,
    ingredientType: 'sauces',
    aliases: ['lemon vinaigrette', 'vinegretti', 'vinaigrette', 'sitruuna'],
  },
  {
    id: 'mineraalivesi-6pack',
    officialName: 'Mineraalivesi 6x0,5L',
    unit: 'LTK',
    packSize: '6x0,5L',
    unitsPerPack: 6,
    packBaseUnit: 'PL',
    unitPriceAlv0: 3.9,
    ingredientType: 'other',
    aliases: [
      'mineral water',
      'mineraalivesi',
      'water 6pack',
      'vesi laatikko',
    ],
  },
  {
    id: 'kiivi-karpalo',
    officialName: 'Kiivi karpalo Pirkka',
    unit: 'KPL',
    packSize: '250 ml',
    unitsPerPack: 8,
    packBaseUnit: 'KPL',
    unitPriceAlv0: 4.0,
    ingredientType: 'other',
    aliases: ['kiwi cranberry', 'kiivi', 'karpalo', 'pirkka kiivi'],
  },
  {
    id: 'focca',
    officialName: 'Focca',
    unit: 'LTK',
    unitsPerPack: 6,
    packBaseUnit: 'KPL',
    unitPriceAlv0: 7.5,
    ingredientType: 'bakery',
    aliases: ['focaccia', 'foccacia', 'focca bread'],
  },
  {
    id: 'puolukka',
    officialName: 'Puolukka',
    unit: 'KG',
    unitPriceAlv0: 5.2,
    ingredientType: 'produce',
    aliases: ['lingonberry', 'lingon', 'puolukat'],
  },
  {
    id: 'ananas',
    officialName: 'Ananas',
    unit: 'KG',
    unitPriceAlv0: 2.8,
    ingredientType: 'produce',
    aliases: ['pineapple', 'ananas'],
  },
  {
    id: 'sokeri-menu',
    officialName: 'Sokeri Menu',
    unit: 'KG',
    unitPriceAlv0: 1.1,
    ingredientType: 'dry_goods',
    aliases: ['sugar', 'sokeri', 'menu sugar'],
  },
  {
    id: 'tomusokeri',
    officialName: 'Tomusokeri',
    unit: 'PKT',
    unitPriceAlv0: 1.6,
    ingredientType: 'dry_goods',
    aliases: ['powdered sugar', 'icing sugar', 'tomusokeri'],
  },
  {
    id: 'vadelmapyre',
    officialName: 'Vadelmapyre',
    unit: 'RAS',
    unitPriceAlv0: 6.9,
    ingredientType: 'frozen',
    aliases: ['raspberry puree', 'vadelma', 'raspberry', 'pyree'],
  },
  {
    id: 'oliivioljy',
    officialName: 'Oliiviöljy',
    unit: 'L',
    unitPriceAlv0: 9.5,
    ingredientType: 'oils',
    aliases: ['olive oil', 'oliivi', 'extra virgin', 'EVOO'],
  },
  {
    id: 'rapsioljy',
    officialName: 'Rapsiöljy',
    unit: 'L',
    unitPriceAlv0: 2.4,
    ingredientType: 'oils',
    aliases: ['rapeseed oil', 'canola', 'rapsi', 'canola oil'],
  },
  {
    id: 'basmatiriisi',
    officialName: 'Basmatiriisi',
    unit: 'KG',
    unitPriceAlv0: 2.9,
    ingredientType: 'dry_goods',
    aliases: ['basmati', 'basmati rice', 'riisi'],
  },
  {
    id: 'nacho-maissilastu',
    officialName: 'Nacho maissilastu tortilla',
    unit: 'PSS',
    unitPriceAlv0: 3.1,
    ingredientType: 'dry_goods',
    aliases: ['nachos', 'tortilla chips', 'maissilastu', 'chips'],
  },
  {
    id: 'falafelpihvi',
    officialName: 'Falafelpihvi',
    unit: 'KPL',
    unitPriceAlv0: 4.5,
    ingredientType: 'frozen',
    aliases: ['falafel', 'falafel patty', 'falafelpihvit'],
  },
  {
    id: 'sushiriisi',
    officialName: 'Sushiriisi',
    unit: 'KG',
    unitPriceAlv0: 2.2,
    ingredientType: 'dry_goods',
    aliases: ['sushi rice', 'sushi', 'riisi sushi'],
  },
  ...SEED_MEAT_POULTRY,
  ...SEED_BUFFET_INGREDIENTS,
  ...SEED_KRUOKA_PRODUCTS,
  ...SEED_EVENT_PRODUCTS,
  ...SEED_INVENTAARIOPOHJA_PRODUCTS,
];

/** Seed quantities so inventaario totals + recipe yield demos work offline */
export const SEED_QTY: Record<string, number> = {
  'mustah-bonne': 3,
  vaahterasiirappi: 2,
  kikherne: 7,
  basmatiriisi: 6,
  falafelpihvi: 40,
  sushiriisi: 9,
  ananas: 5,
  'nacho-maissilastu': 4,
  'pizza-kast': 3,
  oliivioljy: 4,
  'figaro-kapris': 3,
  vadelmapyre: 3,
  polenta: 2,
  'pirkka-macarons': 2,
  pekaanipahkina: 3,
  'tumma-suklaa': 4,
  sitruunavinegretti: 2,
  focca: 2,
  puolukka: 5,
  'sokeri-menu': 8,
  tomusokeri: 3,
  rapsioljy: 3,
  'korean-bbq': 2,
  'kiivi-karpalo': 2,
  'mineraalivesi-6pack': 6,
  ...BUFFET_SEED_QTY,
  ...KRUOKA_SEED_QTY,
  ...INVENTAARIOPOHJA_SEED_QTY,
  // 150-cover Skagen / lohikeitto / tiramisu — last wins
  ...EVENT_SEED_QTY,
};

function seedPlaceForProduct(productId: string): string {
  return EVENT_PRODUCT_PLACE[productId] ?? DEFAULT_PLACE_ID;
}

function makeSeedLine(
  p: Product,
  placeId: string,
  quantity: number | null,
) {
  return {
    id: `line-${p.id}-${placeId}`,
    productId: p.id,
    placeId,
    quantity,
    officialName: p.officialName,
    unit: p.unit,
    unitPriceAlv0: p.unitPriceAlv0,
    countedAt: undefined as string | undefined,
    lastUpdatedAt: undefined as string | undefined,
    verificationStatus:
      quantity != null && quantity > 0 ? ('correct' as const) : undefined,
  };
}

/**
 * Session lines: every product on the default place, plus event mise stock on
 * the storage-typed place (freezer / prep fridge / dry / drawers) when different.
 * Pass `seeded: false` for an empty sheet.
 */
export function createInitialSessionLines(
  products: Product[],
  placeId: string = DEFAULT_PLACE_ID,
  opts?: { seeded?: boolean },
) {
  const seeded = opts?.seeded !== false;
  const knownPlaces = new Set(SEED_PLACES.map((p) => p.id));
  const lines = products.map((p) => {
    const preferred = seedPlaceForProduct(p.id);
    const qtyOnDefault =
      seeded && preferred === placeId ? (SEED_QTY[p.id] ?? null) : null;
    return makeSeedLine(p, placeId, qtyOnDefault);
  });

  if (!seeded) return lines;

  for (const p of products) {
    const preferred = seedPlaceForProduct(p.id);
    if (preferred === placeId) continue;
    if (!knownPlaces.has(preferred)) continue;
    const qty = SEED_QTY[p.id] ?? null;
    if (qty == null) continue;
    lines.push(makeSeedLine(p, preferred, qty));
  }
  return lines;
}

/** Ensure event stock lines exist on preferred places after reconcile. */
export function appendMissingEventPlaceLines(
  existing: ReturnType<typeof createInitialSessionLines>,
  products: Product[],
  opts?: { seeded?: boolean },
) {
  if (opts?.seeded === false) return existing;
  const have = new Set(existing.map((l) => `${l.productId}::${l.placeId}`));
  const extras: typeof existing = [];
  for (const p of products) {
    const preferred = seedPlaceForProduct(p.id);
    if (preferred === DEFAULT_PLACE_ID) continue;
    const key = `${p.id}::${preferred}`;
    if (have.has(key)) continue;
    // Avoid doubling legacy seed that already lives on another place
    const alreadyStocked = existing.some(
      (l) =>
        l.productId === p.id && l.quantity != null && l.quantity > 0,
    );
    if (alreadyStocked) continue;
    const qty = SEED_QTY[p.id] ?? null;
    if (qty == null) continue;
    extras.push(makeSeedLine(p, preferred, qty));
  }
  return extras.length ? [...existing, ...extras] : existing;
}
