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
  {
    id: 'recipe-skagen-toast',
    name: 'Skagen toast',
    aliases: [
      'skagen',
      'skagen toast',
      'skagenröra',
      'skagenrora',
      'skagen leipä',
      'shrimp toast',
    ],
    portionErrorPercent: 0.1,
    ingredients: [
      { productId: 'kruoka-menu-kuoritut-katkaravut-1kg', qtyPerPortion: 0.05 },
      { productId: 'buffet-majoneesi', qtyPerPortion: 0.022 },
      { productId: 'rr-smetana', qtyPerPortion: 0.08 },
      { productId: 'buffet-tillia', qtyPerPortion: 0.1 },
      { productId: 'kruoka-pirkka-sitruuna-luomu', qtyPerPortion: 0.15 },
      { productId: 'kruoka-punasipuli', qtyPerPortion: 0.006 },
      { productId: 'rr-kirjolohen-mati', qtyPerPortion: 0.05 },
      { productId: 'buffet-voileipaleipa', qtyPerPortion: 0.07 },
      { productId: 'buffet-voi', qtyPerPortion: 0.005 },
      { productId: 'figaro-kapris', qtyPerPortion: 0.008 },
    ],
  },
  {
    id: 'recipe-lohikeitto',
    name: 'Lohikeitto',
    aliases: [
      'lohikeitto',
      'salmon soup',
      'creamy salmon soup',
      'finnish salmon soup',
      'kalakeitto',
    ],
    portionErrorPercent: 0.1,
    ingredients: [
      { productId: 'rr-kirjolohi-fil', qtyPerPortion: 0.1 },
      { productId: 'buffet-peruna', qtyPerPortion: 0.13 },
      { productId: 'buffet-sipuli', qtyPerPortion: 0.035 },
      { productId: 'kruoka-purjo', qtyPerPortion: 0.035 },
      { productId: 'kruoka-pirkka-pesty-porkkana-1kg', qtyPerPortion: 0.05 },
      { productId: 'buffet-kerma', qtyPerPortion: 0.055 },
      { productId: 'buffet-voi', qtyPerPortion: 0.01 },
      { productId: 'kruoka-knorr-kalaliemi-75g', qtyPerPortion: 0.04 },
      { productId: 'buffet-tillia', qtyPerPortion: 0.05 },
      { productId: 'kruoka-pirkka-suola-1kg', qtyPerPortion: 0.005 },
    ],
  },
  {
    id: 'recipe-tiramisu',
    name: 'Tiramisu',
    aliases: ['tiramisu', 'tiramisù', 'italian dessert'],
    portionErrorPercent: 0.12,
    ingredients: [
      { productId: 'kruoka-valio-mascarpone-250g', qtyPerPortion: 0.185 },
      { productId: 'buffet-kananmunat', qtyPerPortion: 0.55 },
      { productId: 'sokeri-menu', qtyPerPortion: 0.022 },
      { productId: 'rr-savoijard-keksi', qtyPerPortion: 0.14 },
      { productId: 'kruoka-pirkka-espresso-250g', qtyPerPortion: 0.02 },
      { productId: 'kruoka-pirkka-kaakaojauhe-200g', qtyPerPortion: 0.02 },
      { productId: 'tomusokeri', qtyPerPortion: 0.02 },
    ],
  },
];

/** Default buffer when a recipe does not set its own */
export const DEFAULT_PORTION_ERROR_PERCENT = 0.12;
