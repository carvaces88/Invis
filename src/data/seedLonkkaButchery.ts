import type { Place, Product, UnitCode } from './types';
import { LONKKA_SEED_PLACES, LONKKA_SITE_NAME } from './seedPlaces';

/** Joonas — Ravintola Lonkka butchery sample inventory */
export { LONKKA_SITE_NAME, LONKKA_SEED_PLACES };

export const LONKKA_BUTCHERY_SEED_VERSION = 'lonkka-butchery.v1';

export type LonkkaStockRow = {
  productId: string;
  placeId: string;
  quantity: number;
};

type Spec = {
  slug: string;
  name: string;
  unit: UnitCode;
  price: number;
  qty: number;
  aliases?: string[];
  packSize?: string;
};

const FRIDGE = 'place-lonkka-fridge';
const FREEZER = 'place-lonkka-freezer';

function makeProducts(
  prefix: string,
  placeId: string,
  ingredientType: Product['ingredientType'],
  section: string,
  specs: Spec[],
): { products: Product[]; stock: LonkkaStockRow[] } {
  const products: Product[] = [];
  const stock: LonkkaStockRow[] = [];
  specs.forEach((s, i) => {
    const id = `lonkka-${prefix}-${String(i + 1).padStart(2, '0')}-${s.slug}`;
    products.push({
      id,
      officialName: s.name,
      unit: s.unit,
      packSize: s.packSize,
      unitPriceAlv0: s.price,
      ingredientType,
      section,
      aliases: s.aliases ?? [s.slug.replace(/-/g, ' ')],
      productCode: `LK${prefix.toUpperCase()}${String(i + 1).padStart(3, '0')}`,
    });
    stock.push({ productId: id, placeId, quantity: s.qty });
  });
  return { products, stock };
}

/** Exactly 15 per Mini Invis category (section drives seafood / alcohol / waste). */
const DAIRY = makeProducts('dairy', FRIDGE, 'dairy', 'Dairy', [
  { slug: 'milk', name: 'Kevytmaito 10 L', unit: 'L', price: 0.95, qty: 20, packSize: '10 L' },
  { slug: 'cream', name: 'Ruokakerma 15% 5 L', unit: 'L', price: 3.8, qty: 10, packSize: '5 L' },
  { slug: 'butter', name: 'Voita 5 kg', unit: 'KG', price: 8.9, qty: 8, packSize: '5 kg' },
  { slug: 'eggs', name: 'Kananmunat L 30 kpl', unit: 'KPL', price: 0.32, qty: 90 },
  { slug: 'edam', name: 'Edam juusto 3 kg', unit: 'KG', price: 7.5, qty: 6, packSize: '3 kg' },
  { slug: 'gouda', name: 'Gouda juusto 3 kg', unit: 'KG', price: 8.2, qty: 4, packSize: '3 kg' },
  { slug: 'mozzarella', name: 'Mozzarella 2 kg', unit: 'KG', price: 6.8, qty: 5, packSize: '2 kg' },
  { slug: 'cream-cheese', name: 'Tuorejuusto 1 kg', unit: 'KG', price: 6.5, qty: 3, packSize: '1 kg' },
  { slug: 'sour-cream', name: 'Smetana 2 kg', unit: 'KG', price: 4.5, qty: 4, packSize: '2 kg' },
  { slug: 'yoghurt', name: 'Luonnollinen jogurtti 5 kg', unit: 'KG', price: 2.4, qty: 6, packSize: '5 kg' },
  { slug: 'quark', name: 'Rahka 2 kg', unit: 'KG', price: 3.6, qty: 4, packSize: '2 kg' },
  { slug: 'cottage', name: 'Raejuusto 2 kg', unit: 'KG', price: 4.0, qty: 3, packSize: '2 kg' },
  { slug: 'whipping', name: 'Vispikerma 5 L', unit: 'L', price: 5.2, qty: 5, packSize: '5 L' },
  { slug: 'margarine', name: 'Margariini 5 kg', unit: 'KG', price: 3.2, qty: 6, packSize: '5 kg' },
  { slug: 'grated', name: 'Raastettu juusto 2 kg', unit: 'KG', price: 7.0, qty: 5, packSize: '2 kg' },
]);

const VEG = makeProducts('veg', FRIDGE, 'produce', 'Vegetables', [
  { slug: 'potato', name: 'Peruna 10 kg', unit: 'KG', price: 0.9, qty: 40, packSize: '10 kg' },
  { slug: 'onion', name: 'Sipuli 5 kg', unit: 'KG', price: 1.0, qty: 15, packSize: '5 kg' },
  { slug: 'carrot', name: 'Porkkana 5 kg', unit: 'KG', price: 1.2, qty: 12, packSize: '5 kg' },
  { slug: 'tomato', name: 'Tomaatti 5 kg', unit: 'KG', price: 3.5, qty: 8, packSize: '5 kg' },
  { slug: 'cucumber', name: 'Kurkku 5 kg', unit: 'KG', price: 2.8, qty: 6, packSize: '5 kg' },
  { slug: 'cabbage', name: 'Keräkaali 5 kg', unit: 'KG', price: 1.1, qty: 10, packSize: '5 kg' },
  { slug: 'lettuce', name: 'Jäävuorisalaatti 1 kg', unit: 'KG', price: 2.2, qty: 5, packSize: '1 kg' },
  { slug: 'pepper', name: 'Paprika sekoitus 2 kg', unit: 'KG', price: 4.5, qty: 4, packSize: '2 kg' },
  { slug: 'garlic', name: 'Valkosipuli 1 kg', unit: 'KG', price: 6.0, qty: 2, packSize: '1 kg' },
  { slug: 'leek', name: 'Purjo 2 kg', unit: 'KG', price: 2.5, qty: 4, packSize: '2 kg' },
  { slug: 'celery', name: 'Selleri 2 kg', unit: 'KG', price: 2.0, qty: 3, packSize: '2 kg' },
  { slug: 'mushroom', name: 'Herkkusieni 1 kg', unit: 'KG', price: 5.5, qty: 3, packSize: '1 kg' },
  { slug: 'beetroot', name: 'Punajuuri 5 kg', unit: 'KG', price: 1.4, qty: 6, packSize: '5 kg' },
  { slug: 'herbs', name: 'Tuoreet yrtit nippu', unit: 'KPL', price: 1.8, qty: 12 },
  { slug: 'lemon', name: 'Sitruuna 1 kg', unit: 'KG', price: 2.6, qty: 3, packSize: '1 kg' },
]);

const SEAFOOD = makeProducts('fish', FRIDGE, 'other', 'Seafood', [
  { slug: 'salmon', name: 'Lohifilee tuore 5 kg', unit: 'KG', price: 16, qty: 8, packSize: '5 kg' },
  { slug: 'whitefish', name: 'Siika / seiti 3 kg', unit: 'KG', price: 9.5, qty: 5, packSize: '3 kg' },
  { slug: 'cod', name: 'Turskafilee 3 kg', unit: 'KG', price: 11, qty: 4, packSize: '3 kg' },
  { slug: 'herring', name: 'Silli filee 2 kg', unit: 'KG', price: 6.5, qty: 4, packSize: '2 kg' },
  { slug: 'trout', name: 'Kirjolohi 3 kg', unit: 'KG', price: 12, qty: 4, packSize: '3 kg' },
  { slug: 'shrimp', name: 'Katkarapu kuorittu 1 kg', unit: 'KG', price: 14, qty: 3, packSize: '1 kg' },
  { slug: 'mussels', name: 'Sinisimpukat 2 kg', unit: 'KG', price: 7.5, qty: 3, packSize: '2 kg' },
  { slug: 'squid', name: 'Kalmari 1 kg', unit: 'KG', price: 13, qty: 2, packSize: '1 kg' },
  { slug: 'tuna', name: 'Tonnikala öljyssä 1.7 kg', unit: 'KG', price: 8.2, qty: 5, packSize: '1.7 kg' },
  { slug: 'pike', name: 'Hauki filee 2 kg', unit: 'KG', price: 10, qty: 2, packSize: '2 kg' },
  { slug: 'perch', name: 'Ahvenfilee 1 kg', unit: 'KG', price: 15, qty: 2, packSize: '1 kg' },
  { slug: 'caviar', name: 'Mätitahna 500 g', unit: 'KG', price: 22, qty: 1, packSize: '500 g' },
  { slug: 'crab', name: 'Rapuja keitettyjä 1 kg', unit: 'KG', price: 18, qty: 2, packSize: '1 kg' },
  { slug: 'fish-soup', name: 'Kalaliemi 5 L', unit: 'L', price: 3.5, qty: 8, packSize: '5 L' },
  { slug: 'anchovy', name: 'Anjovis 800 g', unit: 'KG', price: 12, qty: 2, packSize: '800 g' },
]);

const MEAT = makeProducts('meat', FRIDGE, 'meat', 'Meat', [
  { slug: 'beef-mince', name: 'Naudan jauheliha 10% 5 kg', unit: 'KG', price: 9.5, qty: 15, packSize: '5 kg' },
  { slug: 'pork-beef', name: 'Sika-naudan jauheliha 5 kg', unit: 'KG', price: 7.2, qty: 18, packSize: '5 kg' },
  { slug: 'beef-roast', name: 'Naudan paisti 5 kg', unit: 'KG', price: 12, qty: 8, packSize: '5 kg' },
  { slug: 'beef-entrecote', name: 'Entrecôte 3 kg', unit: 'KG', price: 22, qty: 4, packSize: '3 kg' },
  { slug: 'pork-loin', name: 'Porsaanulkofilee 5 kg', unit: 'KG', price: 7.8, qty: 10, packSize: '5 kg' },
  { slug: 'pork-ribs', name: 'Porsaan kylki 5 kg', unit: 'KG', price: 6.8, qty: 8, packSize: '5 kg' },
  { slug: 'pork-shoulder', name: 'Porsaan potka 5 kg', unit: 'KG', price: 5.5, qty: 6, packSize: '5 kg' },
  { slug: 'chicken-breast', name: 'Kananfilee 5 kg', unit: 'KG', price: 8.8, qty: 16, packSize: '5 kg' },
  { slug: 'chicken-thigh', name: 'Kanankoipi 5 kg', unit: 'KG', price: 5.5, qty: 12, packSize: '5 kg' },
  { slug: 'chicken-wings', name: 'Kanansiivet 5 kg', unit: 'KG', price: 4.9, qty: 10, packSize: '5 kg' },
  { slug: 'turkey', name: 'Kalkkunafilee 3 kg', unit: 'KG', price: 9.5, qty: 5, packSize: '3 kg' },
  { slug: 'lamb', name: 'Lampaanpaisti 3 kg', unit: 'KG', price: 14, qty: 3, packSize: '3 kg' },
  { slug: 'bacon', name: 'Pekoni 2 kg', unit: 'KG', price: 8.5, qty: 6, packSize: '2 kg' },
  { slug: 'sausage', name: 'Grillimakkara 3 kg', unit: 'KG', price: 5.2, qty: 9, packSize: '3 kg' },
  { slug: 'ham', name: 'Keittokinkku 3 kg', unit: 'KG', price: 7.0, qty: 5, packSize: '3 kg' },
]);

const FROZEN = makeProducts('froz', FREEZER, 'frozen', 'Frozen', [
  { slug: 'beef-patty', name: 'Pihvit pakaste 2 kg', unit: 'KG', price: 9.0, qty: 10, packSize: '2 kg' },
  { slug: 'meatballs', name: 'Lihapullat pakaste 2 kg', unit: 'KG', price: 7.2, qty: 12, packSize: '2 kg' },
  { slug: 'chicken-nuggets', name: 'Kananuggetsit 2 kg', unit: 'KG', price: 6.8, qty: 8, packSize: '2 kg' },
  { slug: 'salmon-froz', name: 'Lohipalat pakaste 1 kg', unit: 'KG', price: 14, qty: 6, packSize: '1 kg' },
  { slug: 'shrimp-froz', name: 'Katkarapu pakaste 1 kg', unit: 'KG', price: 12, qty: 5, packSize: '1 kg' },
  { slug: 'fries', name: 'Ranskalaiset 2.5 kg', unit: 'KG', price: 2.2, qty: 20, packSize: '2.5 kg' },
  { slug: 'peas', name: 'Pakasteherneet 2.5 kg', unit: 'KG', price: 2.4, qty: 10, packSize: '2.5 kg' },
  { slug: 'spinach', name: 'Pakastespinatti 2.5 kg', unit: 'KG', price: 3.1, qty: 6, packSize: '2.5 kg' },
  { slug: 'berries', name: 'Marjasekoitus 2.5 kg', unit: 'KG', price: 5.8, qty: 5, packSize: '2.5 kg' },
  { slug: 'pastry', name: 'Voitaikinalevyt 1 kg', unit: 'KG', price: 5.2, qty: 4, packSize: '1 kg' },
  { slug: 'bread-rolls', name: 'Sämpylät pakaste 50 kpl', unit: 'KPL', price: 0.35, qty: 50 },
  { slug: 'veal-cutlet', name: 'Vasikanleike pakaste 2 kg', unit: 'KG', price: 11, qty: 4, packSize: '2 kg' },
  { slug: 'reindeer', name: 'Poronliha pakaste 2 kg', unit: 'KG', price: 18, qty: 3, packSize: '2 kg' },
  { slug: 'game-stew', name: 'Riistapata pakaste 2 kg', unit: 'KG', price: 9.5, qty: 4, packSize: '2 kg' },
  { slug: 'ice', name: 'Jäämurska 10 kg', unit: 'KG', price: 0.4, qty: 20, packSize: '10 kg' },
]);

const DRY = makeProducts('dry', FRIDGE, 'dry_goods', 'Dry goods', [
  { slug: 'flour', name: 'Vehnäjauho 10 kg', unit: 'KG', price: 0.85, qty: 20, packSize: '10 kg' },
  { slug: 'salt', name: 'Karkea merisuola 1 kg', unit: 'KG', price: 1.2, qty: 5, packSize: '1 kg' },
  { slug: 'pepper', name: 'Mustapippuri kokonainen 500 g', unit: 'KG', price: 16, qty: 1, packSize: '500 g' },
  { slug: 'paprika', name: 'Paprikajauhe 500 g', unit: 'KG', price: 12, qty: 0.8, packSize: '500 g' },
  { slug: 'oil', name: 'Rypsiöljy 10 L', unit: 'L', price: 2.4, qty: 20, packSize: '10 L' },
  { slug: 'vinegar', name: 'Valkoviinietikka 5 L', unit: 'L', price: 2.1, qty: 6, packSize: '5 L' },
  { slug: 'mustard', name: 'Sinappi 3 kg', unit: 'KG', price: 4.2, qty: 4, packSize: '3 kg' },
  { slug: 'ketchup', name: 'Ketsuppi 5 kg', unit: 'KG', price: 3.6, qty: 5, packSize: '5 kg' },
  { slug: 'broth', name: 'Lihaliemijauhe 1 kg', unit: 'KG', price: 9.5, qty: 2, packSize: '1 kg' },
  { slug: 'rice', name: 'Jasminriisi 5 kg', unit: 'KG', price: 2.8, qty: 10, packSize: '5 kg' },
  { slug: 'pasta', name: 'Penne 5 kg', unit: 'KG', price: 3.2, qty: 8, packSize: '5 kg' },
  { slug: 'sugar', name: 'Kristallisokeri 5 kg', unit: 'KG', price: 1.1, qty: 6, packSize: '5 kg' },
  { slug: 'honey', name: 'Hunaja 5 kg', unit: 'KG', price: 7.5, qty: 3, packSize: '5 kg' },
  { slug: 'foil', name: 'Alumiinifolio 30 cm 150 m', unit: 'PKT', price: 14, qty: 4 },
  { slug: 'cling', name: 'Kelmu 30 cm 300 m', unit: 'PKT', price: 11, qty: 5 },
]);

const ALCOHOL = makeProducts('alko', FRIDGE, 'other', 'Kitchen alcohol', [
  { slug: 'white-wine', name: 'Valkoviini keittiö 5 L', unit: 'L', price: 6.5, qty: 10, packSize: '5 L' },
  { slug: 'red-wine', name: 'Punaviini keittiö 5 L', unit: 'L', price: 6.8, qty: 8, packSize: '5 L' },
  { slug: 'brandy', name: 'Konjakki keittiö 1 L', unit: 'L', price: 22, qty: 2, packSize: '1 L' },
  { slug: 'cognac', name: 'Cognac flambé 0.7 L', unit: 'L', price: 28, qty: 1, packSize: '0.7 L' },
  { slug: 'vodka', name: 'Vodka keittiö 1 L', unit: 'L', price: 18, qty: 2, packSize: '1 L' },
  { slug: 'beer-dark', name: 'Tumma olut keittiö 5 L', unit: 'L', price: 4.5, qty: 5, packSize: '5 L' },
  { slug: 'beer-lager', name: 'Lager keittiö 5 L', unit: 'L', price: 3.8, qty: 6, packSize: '5 L' },
  { slug: 'sherry', name: 'Sherry 0.75 L', unit: 'L', price: 12, qty: 2, packSize: '0.75 L' },
  { slug: 'port', name: 'Portviini 0.75 L', unit: 'L', price: 14, qty: 1, packSize: '0.75 L' },
  { slug: 'rum', name: 'Rommi keittiö 1 L', unit: 'L', price: 20, qty: 1, packSize: '1 L' },
  { slug: 'sake', name: 'Sake 0.75 L', unit: 'L', price: 16, qty: 1, packSize: '0.75 L' },
  { slug: 'vermouth', name: 'Vermutti 0.75 L', unit: 'L', price: 11, qty: 2, packSize: '0.75 L' },
  { slug: 'cider', name: 'Siideri keittiö 5 L', unit: 'L', price: 3.5, qty: 4, packSize: '5 L' },
  { slug: 'apple-brandy', name: 'Calvados 0.7 L', unit: 'L', price: 26, qty: 1, packSize: '0.7 L' },
  { slug: 'marsala', name: 'Marsala 0.75 L', unit: 'L', price: 13, qty: 2, packSize: '0.75 L' },
]);

const OTHER = makeProducts('other', FRIDGE, 'other', 'Other', [
  { slug: 'gloves', name: 'Kertakäyttökäsineet L 100 kpl', unit: 'PKT', price: 9.5, qty: 8 },
  { slug: 'aprons', name: 'Esiliinat kertakäyttö 50 kpl', unit: 'PKT', price: 12, qty: 4 },
  { slug: 'butcher-paper', name: 'Liha paperi 40 cm 100 m', unit: 'PKT', price: 18, qty: 3 },
  { slug: 'vacuum-bags', name: 'Vakuumipussit 100 kpl', unit: 'PKT', price: 22, qty: 5 },
  { slug: 'labels', name: 'Päivämäärä tarrat 500 kpl', unit: 'PKT', price: 8, qty: 4 },
  { slug: 'twine', name: 'Paistinlanka 200 m', unit: 'PKT', price: 6.5, qty: 3 },
  { slug: 'skewers', name: 'Vartaat 200 kpl', unit: 'PKT', price: 7, qty: 4 },
  { slug: 'netting', name: 'Lihaverkko 50 m', unit: 'PKT', price: 15, qty: 2 },
  { slug: 'casings', name: 'Makkarankuoret 5 kg', unit: 'KG', price: 9, qty: 3, packSize: '5 kg' },
  { slug: 'sausage-spice', name: 'Makkaramauste 1 kg', unit: 'KG', price: 14, qty: 2, packSize: '1 kg' },
  { slug: 'smoke-chips', name: 'Savulastut 2 kg', unit: 'KG', price: 5.5, qty: 3, packSize: '2 kg' },
  { slug: 'charcoal', name: 'Grillihilli 10 kg', unit: 'KG', price: 1.8, qty: 10, packSize: '10 kg' },
  { slug: 'ice-packs', name: 'Kylmäkalle 10 kpl', unit: 'KPL', price: 2.5, qty: 10 },
  { slug: 'scale-batteries', name: 'Vaaka paristot AA 8 kpl', unit: 'PKT', price: 6, qty: 2 },
  { slug: 'soap', name: 'Käsisaippua teurastamo 5 L', unit: 'L', price: 4.0, qty: 6, packSize: '5 L' },
]);

const WASTE = makeProducts('waste', FRIDGE, 'other', 'Waste', [
  { slug: 'bones-beef', name: 'Naudan luut (liemi) 5 kg', unit: 'KG', price: 1.2, qty: 10, packSize: '5 kg' },
  { slug: 'bones-pork', name: 'Porsaan luut 5 kg', unit: 'KG', price: 0.9, qty: 8, packSize: '5 kg' },
  { slug: 'bones-chicken', name: 'Kananruhot 5 kg', unit: 'KG', price: 0.8, qty: 12, packSize: '5 kg' },
  { slug: 'fat-beef', name: 'Naudanrasva 5 kg', unit: 'KG', price: 1.5, qty: 6, packSize: '5 kg' },
  { slug: 'fat-pork', name: 'Sianrasva 5 kg', unit: 'KG', price: 1.3, qty: 5, packSize: '5 kg' },
  { slug: 'trimmings', name: 'Lihan trimmaus 5 kg', unit: 'KG', price: 2.0, qty: 8, packSize: '5 kg' },
  { slug: 'blood', name: 'Veri (mustamakkara) 5 L', unit: 'L', price: 2.5, qty: 4, packSize: '5 L' },
  { slug: 'organs', name: 'Sisäelimet sekoitus 3 kg', unit: 'KG', price: 3.5, qty: 3, packSize: '3 kg' },
  { slug: 'skin', name: 'Siannahka 3 kg', unit: 'KG', price: 1.8, qty: 4, packSize: '3 kg' },
  { slug: 'cartilage', name: 'Rustot 2 kg', unit: 'KG', price: 1.0, qty: 3, packSize: '2 kg' },
  { slug: 'fish-frames', name: 'Kalankehykset 5 kg', unit: 'KG', price: 0.7, qty: 6, packSize: '5 kg' },
  { slug: 'spoil-meat', name: 'Hävikkiliha merkitty 2 kg', unit: 'KG', price: 0, qty: 1, packSize: '2 kg' },
  { slug: 'spoil-fish', name: 'Hävikkikala merkitty 1 kg', unit: 'KG', price: 0, qty: 1, packSize: '1 kg' },
  { slug: 'compost', name: 'Komposti biojäte säkki', unit: 'KPL', price: 0, qty: 3 },
  { slug: 'render', name: 'Rasvan sulatus 5 kg', unit: 'KG', price: 0.5, qty: 4, packSize: '5 kg' },
]);

export const LONKKA_BUTCHERY_PRODUCTS: Product[] = [
  ...DAIRY.products,
  ...VEG.products,
  ...SEAFOOD.products,
  ...MEAT.products,
  ...FROZEN.products,
  ...DRY.products,
  ...ALCOHOL.products,
  ...OTHER.products,
  ...WASTE.products,
];

export const LONKKA_BUTCHERY_STOCK: LonkkaStockRow[] = [
  ...DAIRY.stock,
  ...VEG.stock,
  ...SEAFOOD.stock,
  ...MEAT.stock,
  ...FROZEN.stock,
  ...DRY.stock,
  ...ALCOHOL.stock,
  ...OTHER.stock,
  ...WASTE.stock,
];

export function isLonkkaButcheryProductId(id: string): boolean {
  return id.startsWith('lonkka-');
}

export function hasLonkkaButcherySeed(products: Product[]): boolean {
  return products.some((p) => isLonkkaButcheryProductId(p.id));
}
