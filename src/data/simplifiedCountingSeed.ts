import type { UnitCode } from './types';

/** Draft categories for Simplified Counting (sheet tabs). */
export type SimplifiedCategoryId =
  | 'stock_values'
  | 'dairy'
  | 'vegetables'
  | 'seafood'
  | 'frozen'
  | 'dry_goods';

export type SimplifiedCountItem = {
  id: string;
  nameEn: string;
  nameFi: string;
  quantity: number;
  unit: UnitCode;
  unitPriceAlv0: number;
};

export const SIMPLIFIED_CATEGORIES: {
  id: SimplifiedCategoryId;
  /** i18n MessageKey suffix mapped in screen via t() */
  labelKey:
    | 'simpCountCatStockValues'
    | 'simpCountCatDairy'
    | 'simpCountCatVegetables'
    | 'simpCountCatSeafood'
    | 'simpCountCatFrozen'
    | 'simpCountCatDryGoods';
}[] = [
  { id: 'stock_values', labelKey: 'simpCountCatStockValues' },
  { id: 'dairy', labelKey: 'simpCountCatDairy' },
  { id: 'vegetables', labelKey: 'simpCountCatVegetables' },
  { id: 'seafood', labelKey: 'simpCountCatSeafood' },
  { id: 'frozen', labelKey: 'simpCountCatFrozen' },
  { id: 'dry_goods', labelKey: 'simpCountCatDryGoods' },
];

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

/** Placeholder lines for categories not yet imported from the sheet. */
export const PLACEHOLDER_BY_CATEGORY: Partial<
  Record<SimplifiedCategoryId, SimplifiedCountItem[]>
> = {
  dairy: DAIRY_COUNT_SEED,
  vegetables: [],
  seafood: [],
  frozen: [],
  dry_goods: [],
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
