import type { Recipe } from './types';

/**
 * Recipe book for “how many dishes can I make?”
 * qtyPerPortion uses the product’s stock unit.
 * Buffet recipes sized per guest cover (~150 service demos).
 */
export const SEED_RECIPES: Recipe[] = [
  {
    id: 'recipe-falafel-bowl',
    name: 'Falafel bowl',
    aliases: ['falafel bowl', 'bowl', 'falafel annos'],
    portionErrorPercent: 0.12,
    ingredients: [
      { productId: 'falafelpihvi', qtyPerPortion: 2 },
      { productId: 'basmatiriisi', qtyPerPortion: 0.12 },
      { productId: 'kikherne', qtyPerPortion: 0.15 },
    ],
  },
  {
    id: 'recipe-sushi-set',
    name: 'Sushi set',
    aliases: ['sushi', 'sushi set', 'sushisetti'],
    portionErrorPercent: 0.15,
    ingredients: [
      { productId: 'sushiriisi', qtyPerPortion: 0.08 },
      { productId: 'ananas', qtyPerPortion: 0.02 },
    ],
  },
  {
    id: 'recipe-nacho-plate',
    name: 'Nacho plate',
    aliases: ['nachos', 'nacho plate', 'nacholautanen'],
    portionErrorPercent: 0.1,
    ingredients: [
      { productId: 'nacho-maissilastu', qtyPerPortion: 0.25 },
      { productId: 'pizza-kast', qtyPerPortion: 0.1 },
      { productId: 'oliivioljy', qtyPerPortion: 0.01 },
    ],
  },
  {
    id: 'recipe-hot-meat-casserole',
    name: 'Hot dish · mince casserole',
    aliases: [
      'casserole',
      'jauhelihakastike',
      'hot dish mince',
      'lihapata',
      'hot dish 1',
    ],
    portionErrorPercent: 0.12,
    ingredients: [
      { productId: 'pirkka-sikanaudan-jauheliha-23', qtyPerPortion: 0.1 },
      { productId: 'buffet-sipuli', qtyPerPortion: 0.03 },
      { productId: 'buffet-peruna', qtyPerPortion: 0.12 },
      { productId: 'buffet-tomaattimurska', qtyPerPortion: 0.04 },
      { productId: 'buffet-kerma', qtyPerPortion: 0.04 },
      { productId: 'buffet-lihaliemi', qtyPerPortion: 0.005 },
    ],
  },
  {
    id: 'recipe-hot-honey-chicken',
    name: 'Hot dish · honey chicken strips',
    aliases: [
      'honey chicken',
      'kanan suikale',
      'hot dish chicken',
      'hot dish 2',
      'hunajakana',
    ],
    portionErrorPercent: 0.1,
    ingredients: [
      { productId: 'kariniemen-suikale-hunaja', qtyPerPortion: 0.3 },
      { productId: 'buffet-paprika', qtyPerPortion: 0.02 },
      { productId: 'buffet-sipuli', qtyPerPortion: 0.015 },
      { productId: 'rapsioljy', qtyPerPortion: 0.008 },
    ],
  },
  {
    id: 'recipe-buffet-soup',
    name: 'Soup of the day · vegetable',
    aliases: ['soup', 'keitto', 'soup of the day', 'kasviskeitto'],
    portionErrorPercent: 0.08,
    ingredients: [
      { productId: 'buffet-porkkana', qtyPerPortion: 0.05 },
      { productId: 'buffet-selleri', qtyPerPortion: 0.02 },
      { productId: 'buffet-sipuli', qtyPerPortion: 0.015 },
      { productId: 'buffet-kasvisliemi', qtyPerPortion: 0.008 },
      { productId: 'buffet-kerma', qtyPerPortion: 0.03 },
      { productId: 'buffet-voi', qtyPerPortion: 0.008 },
    ],
  },
  {
    id: 'recipe-buffet-salad-plate',
    name: 'Salad bar plate',
    aliases: ['salad', 'salaatti', 'salad bar', 'buffet salad'],
    portionErrorPercent: 0.15,
    ingredients: [
      { productId: 'buffet-kurkku', qtyPerPortion: 0.04 },
      { productId: 'buffet-tomaatti', qtyPerPortion: 0.05 },
      { productId: 'buffet-jaasalatti', qtyPerPortion: 0.08 },
      { productId: 'buffet-kaali', qtyPerPortion: 0.03 },
      { productId: 'hk-ohut-saunapalvikinkku', qtyPerPortion: 0.05 },
      { productId: 'buffet-feta', qtyPerPortion: 0.015 },
    ],
  },
  {
    id: 'recipe-garlic-mayo-dip',
    name: 'Dip · garlic mayo',
    aliases: ['mayo dip', 'garlic dip', 'valkosipulimajoneesi', 'dip 1'],
    portionErrorPercent: 0.2,
    ingredients: [
      { productId: 'buffet-majoneesi', qtyPerPortion: 0.025 },
      { productId: 'buffet-valkosipuli', qtyPerPortion: 0.002 },
      { productId: 'buffet-sitruuna', qtyPerPortion: 0.005 },
    ],
  },
  {
    id: 'recipe-herb-yogurt-dip',
    name: 'Dip · herb yogurt',
    aliases: ['yogurt dip', 'herb dip', 'tillidippi', 'dip 2'],
    portionErrorPercent: 0.2,
    ingredients: [
      { productId: 'buffet-turkkilainen-jogurtti', qtyPerPortion: 0.03 },
      { productId: 'buffet-tillia', qtyPerPortion: 0.02 },
      { productId: 'buffet-sitruuna', qtyPerPortion: 0.004 },
    ],
  },
  {
    id: 'recipe-bread-of-day',
    name: 'Bread of the day',
    aliases: ['bread', 'leipä', 'bread of the day', 'sämpylä'],
    portionErrorPercent: 0.1,
    ingredients: [
      { productId: 'buffet-sämpylä', qtyPerPortion: 1 },
      { productId: 'buffet-voi', qtyPerPortion: 0.01 },
    ],
  },
];

/** Default buffer when a recipe does not set its own */
export const DEFAULT_PORTION_ERROR_PERCENT = 0.12;
