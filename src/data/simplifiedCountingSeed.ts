import type { UnitCode } from './types';

/** Draft categories for Simplified Counting (sheet tabs). */
export type SimplifiedCategoryId =
  | 'stock_values'
  | 'all_items'
  | 'dairy'
  | 'vegetables'
  | 'seafood'
  | 'meat'
  | 'frozen'
  | 'dry_goods'
  | 'kitchen_alcohol'
  | 'other'
  | 'waste';

/** Categories that actually hold product lines (not virtual sheet tabs). */
export type SimplifiedItemCategoryId = Exclude<
  SimplifiedCategoryId,
  'stock_values' | 'all_items'
>;

export type SimplifiedCountItem = {
  id: string;
  nameEn: string;
  nameFi: string;
  quantity: number;
  unit: UnitCode;
  unitPriceAlv0: number;
  /** Extra search nicknames (FI/EN). Other-language name is always searchable. */
  aliases?: string[];
};

export const SIMPLIFIED_CATEGORIES: {
  id: SimplifiedCategoryId;
  /** i18n MessageKey suffix mapped in screen via t() */
  labelKey:
    | 'simpCountCatStockValues'
    | 'simpCountCatAllItems'
    | 'simpCountCatDairy'
    | 'simpCountCatVegetables'
    | 'simpCountCatSeafood'
    | 'simpCountCatMeat'
    | 'simpCountCatFrozen'
    | 'simpCountCatDryGoods'
    | 'simpCountCatKitchenAlcohol'
    | 'simpCountCatOther'
    | 'simpCountCatWaste';
}[] = [
  { id: 'stock_values', labelKey: 'simpCountCatStockValues' },
  { id: 'all_items', labelKey: 'simpCountCatAllItems' },
  { id: 'dairy', labelKey: 'simpCountCatDairy' },
  { id: 'vegetables', labelKey: 'simpCountCatVegetables' },
  { id: 'seafood', labelKey: 'simpCountCatSeafood' },
  { id: 'meat', labelKey: 'simpCountCatMeat' },
  { id: 'frozen', labelKey: 'simpCountCatFrozen' },
  { id: 'dry_goods', labelKey: 'simpCountCatDryGoods' },
  { id: 'kitchen_alcohol', labelKey: 'simpCountCatKitchenAlcohol' },
  { id: 'other', labelKey: 'simpCountCatOther' },
  { id: 'waste', labelKey: 'simpCountCatWaste' },
];

/** Category rows on the Stock values / food stock sheet (order matches inventaario sheet). */
export const STOCK_VALUE_CATEGORY_IDS: SimplifiedItemCategoryId[] = [
  'dairy',
  'vegetables',
  'seafood',
  'meat',
  'frozen',
  'dry_goods',
  'kitchen_alcohol',
  'other',
  'waste',
];

export const ITEM_CATEGORY_IDS: SimplifiedItemCategoryId[] = [
  ...STOCK_VALUE_CATEGORY_IDS,
];

export function isItemCategoryId(
  id: SimplifiedCategoryId,
): id is SimplifiedItemCategoryId {
  return id !== 'stock_values' && id !== 'all_items';
}

/**
 * August sheet category totals (used when a category has no seeded lines yet).
 * Live `categoryTotal(items)` wins once products exist in that category.
 */
export const AUGUST_SHEET_CATEGORY_TOTALS: Record<
  SimplifiedItemCategoryId,
  number
> = {
  dairy: 560.29,
  vegetables: 527.29,
  seafood: 558.81,
  meat: 5995.61,
  frozen: 886.69,
  dry_goods: 3441.1,
  kitchen_alcohol: 207.9,
  other: 0,
  waste: 0,
};

/** Lönkka Bull & Bottle · August dairy sheet (draft seed). */
export const DAIRY_COUNT_SEED: SimplifiedCountItem[] = [
  {
    id: 'dairy-milk-red',
    nameEn: 'Red milk',
    nameFi: 'Maito, punainen',
    quantity: 12,
    unit: 'L',
    unitPriceAlv0: 1.6,
  },
  {
    id: 'dairy-cream-lf',
    nameEn: 'Lactose-free cream',
    nameFi: 'Kerma, laktoositon',
    quantity: 10,
    unit: 'L',
    unitPriceAlv0: 3.9,
  },
  {
    id: 'dairy-butter-lf',
    nameEn: 'Lactose-free butter',
    nameFi: 'Voi, laktoositon',
    quantity: 15,
    unit: 'KG',
    unitPriceAlv0: 7.6,
  },
  {
    id: 'dairy-mayo',
    nameEn: 'Mayonnaise',
    nameFi: 'Majoneesi',
    quantity: 2,
    unit: 'KG',
    unitPriceAlv0: 5.14,
  },
  {
    id: 'dairy-cheddar-applewood',
    nameEn: 'Cheddar (Applewood)',
    nameFi: 'Cheddar, omenapuu',
    quantity: 3,
    unit: 'KG',
    unitPriceAlv0: 19.84,
  },
  {
    id: 'dairy-mascarpone',
    nameEn: 'Mascarpone',
    nameFi: 'Mascarpone',
    quantity: 1,
    unit: 'KG',
    unitPriceAlv0: 10.93,
  },
  {
    id: 'dairy-cream-cheese-vanilla',
    nameEn: 'Cream cheese, vanilla',
    nameFi: 'Tuorejuusto, vanilja',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 11.21,
  },
  {
    id: 'dairy-cream-cheese',
    nameEn: 'Cream cheese',
    nameFi: 'Tuorejuusto',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 6.83,
  },
  {
    id: 'dairy-halloumi',
    nameEn: 'Halloumi',
    nameFi: 'Halloumi',
    quantity: 1,
    unit: 'KG',
    unitPriceAlv0: 13.67,
  },
  {
    id: 'dairy-feta',
    nameEn: 'Feta cheese',
    nameFi: 'Fetajuusto',
    quantity: 1,
    unit: 'KG',
    unitPriceAlv0: 13.74,
  },
  {
    id: 'dairy-burrata',
    nameEn: 'Burrata',
    nameFi: 'Burrata',
    quantity: 0,
    unit: 'KPL',
    unitPriceAlv0: 2.25,
  },
  {
    id: 'dairy-turkish-yogurt',
    nameEn: 'Turkish yogurt',
    nameFi: 'Turkkilainen jogurtti',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 3.74,
  },
  {
    id: 'dairy-buffalo-mozz',
    nameEn: 'Buffalo mozzarella',
    nameFi: 'Buffalo mozzarella',
    quantity: 3,
    unit: 'KG',
    unitPriceAlv0: 12.24,
  },
  {
    id: 'dairy-creme-fraiche',
    nameEn: 'Crème fraîche',
    nameFi: 'Creme fraiche',
    quantity: 2,
    unit: 'KG',
    unitPriceAlv0: 4.22,
  },
  {
    id: 'dairy-smetana',
    nameEn: 'Smetana',
    nameFi: 'Smetana',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 9.71,
  },
  {
    id: 'dairy-parmesan',
    nameEn: 'Parmesan Reggiano',
    nameFi: 'Parmesan reggiano',
    quantity: 1,
    unit: 'KG',
    unitPriceAlv0: 28.43,
  },
  {
    id: 'dairy-gruyere',
    nameEn: 'Gruyère',
    nameFi: 'Gruyere',
    quantity: 3,
    unit: 'KG',
    unitPriceAlv0: 26.99,
  },
  {
    id: 'dairy-viinitarhuri',
    nameEn: 'Viinitarhuri',
    nameFi: 'Viinitarhuri',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 30.51,
  },
  {
    id: 'dairy-vilho',
    nameEn: 'Vilho',
    nameFi: 'Vilho',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 29.52,
  },
  {
    id: 'dairy-aura-crumb',
    nameEn: 'Blue cheese crumbles',
    nameFi: 'Aurajuustomuru',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 15.53,
  },
  {
    id: 'dairy-mozz-grated',
    nameEn: 'Grated mozzarella',
    nameFi: 'Mozzarellaraaste',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 7.98,
  },
  {
    id: 'dairy-tofu',
    nameEn: 'Tofu',
    nameFi: 'Tofu',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 6.72,
  },
  {
    id: 'dairy-goat-fresh',
    nameEn: 'Fresh goat cheese',
    nameFi: 'Vuohenjuusto, tuore',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 17.03,
  },
  {
    id: 'dairy-oat-milk',
    nameEn: 'Oat milk',
    nameFi: 'Kauramaito',
    quantity: 9,
    unit: 'L',
    unitPriceAlv0: 2.32,
  },
  {
    id: 'dairy-gouda',
    nameEn: 'Gouda cheese',
    nameFi: 'Gouda juusto',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 11.58,
  },
  {
    id: 'dairy-koskenlaskija',
    nameEn: 'Koskenlaskija',
    nameFi: 'Koskenlaskija',
    quantity: 0,
    unit: 'KPL',
    unitPriceAlv0: 2.83,
  },
  {
    id: 'dairy-grana-padano',
    nameEn: 'Grated Grana Padano',
    nameFi: 'Grana Padano raaste',
    quantity: 1,
    unit: 'KG',
    unitPriceAlv0: 16.23,
  },
  {
    id: 'dairy-gran-castelli',
    nameEn: 'Gran Castelli',
    nameFi: 'Gran castelli',
    quantity: 0,
    unit: 'PSS',
    unitPriceAlv0: 9.34,
  },
  {
    id: 'dairy-brie',
    nameEn: 'Brie',
    nameFi: 'Brie',
    quantity: 1.3,
    unit: 'KG',
    unitPriceAlv0: 24.41,
  },
  {
    id: 'dairy-roquefort',
    nameEn: 'Roquefort',
    nameFi: 'Roquefort',
    quantity: 1.5,
    unit: 'KG',
    unitPriceAlv0: 37.7,
  },
  {
    id: 'dairy-champagne-cheddar',
    nameEn: 'Champagne cheddar',
    nameFi: 'Champagne cheddar',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 19.61,
  },
  {
    id: 'dairy-appenzeller',
    nameEn: 'Appenzeller',
    nameFi: 'Appenzeller',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 32,
  },
  {
    id: 'dairy-american',
    nameEn: 'American cheese',
    nameFi: 'Amerikan juusto',
    quantity: 0,
    unit: 'KG',
    unitPriceAlv0: 10.73,
  },
  {
    id: 'dairy-ricotta',
    nameEn: 'Ricotta',
    nameFi: 'Ricotta',
    quantity: 0,
    unit: 'PRK',
    unitPriceAlv0: 1.89,
  },
];

/** Extra kitchen nicknames for search / “also known as” tooltips. */
const DAIRY_EXTRA_ALIASES: Record<string, string[]> = {
  'dairy-milk-red': ['whole milk', 'täysmaito', 'punainen maito', 'milk'],
  'dairy-cream-lf': ['LH cream', 'laktoositon kerma', 'cream'],
  'dairy-butter-lf': ['LH butter', 'laktoositon voi', 'butter'],
  'dairy-mayo': ['mayo', 'hellmanns', 'majo'],
  'dairy-cheddar-applewood': ['applewood', 'omenapuu cheddar', 'cheddar'],
  'dairy-mascarpone': ['maskarpone'],
  'dairy-cream-cheese-vanilla': ['vanilla cream cheese', 'vanilja tuorejuusto'],
  'dairy-cream-cheese': ['philadelphia', 'tuorejuusto'],
  'dairy-halloumi': ['halloumi'],
  'dairy-feta': ['feta'],
  'dairy-burrata': ['burrata'],
  'dairy-turkish-yogurt': ['turkkilainen', 'jogurtti', 'yogurt'],
  'dairy-buffalo-mozz': ['buffalo', 'mozzarella', 'bufala'],
  'dairy-creme-fraiche': ['crème fraiche', 'cremefraiche', 'ranskankerma'],
  'dairy-smetana': ['sour cream', 'smétana'],
  'dairy-parmesan': ['parmesan', 'reggiano', 'parm'],
  'dairy-gruyere': ['gruyere', 'gryere'],
  'dairy-viinitarhuri': ['wine cheese'],
  'dairy-vilho': ['vilho cheese'],
  'dairy-aura-crumb': ['aura', 'blue cheese', 'aurajuusto'],
  'dairy-mozz-grated': ['mozzarella grated', 'raaste'],
  'dairy-tofu': ['bean curd'],
  'dairy-goat-fresh': ['goat cheese', 'vuohenjuusto'],
  'dairy-oat-milk': ['oatly', 'kauramaito', 'oat drink'],
  'dairy-gouda': ['gouda'],
  'dairy-koskenlaskija': ['koskenlaskija'],
  'dairy-grana-padano': ['grana padano', 'grana'],
  'dairy-gran-castelli': ['castelli'],
  'dairy-brie': ['brie'],
  'dairy-roquefort': ['roquefort', 'blue'],
  'dairy-champagne-cheddar': ['champagne'],
  'dairy-appenzeller': ['appenzeller'],
  'dairy-american': ['american slices', 'burger cheese'],
  'dairy-ricotta': ['ricotta'],
};

function withDairyAliases(
  rows: SimplifiedCountItem[],
): SimplifiedCountItem[] {
  return rows.map((row) => ({
    ...row,
    aliases: [
      ...new Set([...(row.aliases ?? []), ...(DAIRY_EXTRA_ALIASES[row.id] ?? [])]),
    ],
  }));
}

const DAIRY_COUNT_SEEDED = withDairyAliases(DAIRY_COUNT_SEED);

/** Placeholder lines for categories not yet imported from the sheet. */
export const PLACEHOLDER_BY_CATEGORY: Record<
  SimplifiedItemCategoryId,
  SimplifiedCountItem[]
> = {
  dairy: DAIRY_COUNT_SEEDED,
  vegetables: [],
  seafood: [],
  meat: [],
  frozen: [],
  dry_goods: [],
  kitchen_alcohol: [],
  other: [],
  waste: [],
};

export function lineTotal(item: SimplifiedCountItem): number {
  return Math.round(item.quantity * item.unitPriceAlv0 * 100) / 100;
}

export function categoryTotal(items: SimplifiedCountItem[]): number {
  return (
    Math.round(items.reduce((sum, item) => sum + lineTotal(item), 0) * 100) /
    100
  );
}

/** Live sum when seeded; otherwise August sheet total so Stock values matches the inventaario sheet. */
export function resolveCategoryStockTotal(
  categoryId: SimplifiedItemCategoryId,
  items: SimplifiedCountItem[],
): number {
  if (items.length > 0) return categoryTotal(items);
  return AUGUST_SHEET_CATEGORY_TOTALS[categoryId] ?? 0;
}

export function findItemCategory(
  byCategory: Record<SimplifiedCategoryId, SimplifiedCountItem[]>,
  itemId: string,
): SimplifiedItemCategoryId | null {
  for (const cid of ITEM_CATEGORY_IDS) {
    if ((byCategory[cid] ?? []).some((row) => row.id === itemId)) return cid;
  }
  return null;
}

export function flattenAllItems(
  byCategory: Record<SimplifiedCategoryId, SimplifiedCountItem[]>,
): SimplifiedCountItem[] {
  return ITEM_CATEGORY_IDS.flatMap((cid) => byCategory[cid] ?? []);
}

/** Other-language name + nicknames (excludes the primary display name). */
export function itemAlsoKnownAs(
  item: SimplifiedCountItem,
  locale: 'en' | 'fi',
): string[] {
  const primary = (locale === 'fi' ? item.nameFi : item.nameEn).trim();
  const primaryLower = primary.toLowerCase();
  const out: string[] = [];
  const push = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (v.toLowerCase() === primaryLower) return;
    if (out.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    out.push(v);
  };
  push(locale === 'fi' ? item.nameEn : item.nameFi);
  for (const a of item.aliases ?? []) push(a);
  return out;
}

export function itemMatchesQuery(
  item: SimplifiedCountItem,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    item.nameEn,
    item.nameFi,
    ...(item.aliases ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function alsoKnownAsLabel(
  item: SimplifiedCountItem,
  locale: 'en' | 'fi',
  alsoAsPrefix: string,
): string | null {
  const names = itemAlsoKnownAs(item, locale);
  if (!names.length) return null;
  return `${alsoAsPrefix} ${names.join(', ')}`;
}
