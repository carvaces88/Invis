import type { Place, Product, UnitCode } from './types';

/** Heidi — Fair Buffet at Messukeskus */
export const FAIR_BUFFET_SITE_NAME = 'Fair Buffet · Messukeskus';

export const FAIR_BUFFET_SEED_PLACES: Place[] = [
  {
    id: 'place-fair-dry',
    name: 'Dry storage',
    kind: 'pantry',
    storageType: 'dry_storage',
    sortOrder: 0,
  },
  {
    id: 'place-fair-freezer',
    name: 'Freezer',
    kind: 'freezer',
    storageType: 'freezer',
    sortOrder: 1,
  },
  {
    id: 'place-fair-veg',
    name: 'Vegetables',
    kind: 'kitchen',
    storageType: 'prep_fridge',
    sortOrder: 2,
  },
  {
    id: 'place-fair-cleaning',
    name: 'Cleaning cabinet',
    kind: 'other',
    storageType: 'drawers',
    sortOrder: 3,
  },
  {
    id: 'place-fair-dairy',
    name: 'Dairy',
    kind: 'kitchen',
    storageType: 'prep_fridge',
    sortOrder: 4,
  },
  {
    id: 'place-fair-meats',
    name: 'Meats',
    kind: 'kitchen',
    storageType: 'prep_fridge',
    sortOrder: 5,
  },
];

export type FairBuffetStockRow = {
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

function makeProducts(
  prefix: string,
  placeId: string,
  ingredientType: Product['ingredientType'],
  section: string,
  specs: Spec[],
): { products: Product[]; stock: FairBuffetStockRow[] } {
  const products: Product[] = [];
  const stock: FairBuffetStockRow[] = [];
  specs.forEach((s, i) => {
    const id = `fair-${prefix}-${String(i + 1).padStart(2, '0')}-${s.slug}`;
    products.push({
      id,
      officialName: s.name,
      unit: s.unit,
      packSize: s.packSize,
      unitPriceAlv0: s.price,
      ingredientType,
      section,
      aliases: s.aliases ?? [s.slug.replace(/-/g, ' ')],
      productCode: `FB${prefix.toUpperCase()}${String(i + 1).padStart(3, '0')}`,
    });
    stock.push({ productId: id, placeId, quantity: s.qty });
  });
  return { products, stock };
}

const DRY = makeProducts('dry', 'place-fair-dry', 'dry_goods', 'Dry storage', [
  { slug: 'pasta-penne', name: 'Barilla penne 5 kg', unit: 'KG', price: 3.2, qty: 25, packSize: '5 kg' },
  { slug: 'pasta-spaghetti', name: 'Barilla spaghetti 5 kg', unit: 'KG', price: 3.1, qty: 20, packSize: '5 kg' },
  { slug: 'rice-jasmin', name: 'Jasminriisi 5 kg', unit: 'KG', price: 2.8, qty: 30, packSize: '5 kg' },
  { slug: 'rice-risotto', name: 'Risottoriisi Arborio 1 kg', unit: 'KG', price: 4.5, qty: 8, packSize: '1 kg' },
  { slug: 'flour-wheat', name: 'Vehnäjauho 10 kg', unit: 'KG', price: 0.85, qty: 40, packSize: '10 kg' },
  { slug: 'sugar-white', name: 'Kristallisokeri 5 kg', unit: 'KG', price: 1.1, qty: 15, packSize: '5 kg' },
  { slug: 'salt-fine', name: 'Hieno ruokasuola 1 kg', unit: 'KG', price: 0.6, qty: 6, packSize: '1 kg' },
  { slug: 'oil-rapeseed', name: 'Rypsiöljy 10 L', unit: 'L', price: 2.4, qty: 40, packSize: '10 L' },
  { slug: 'oil-olive', name: 'Oliiviöljy 5 L', unit: 'L', price: 8.9, qty: 10, packSize: '5 L' },
  { slug: 'vinegar', name: 'Valkoviinietikka 5 L', unit: 'L', price: 2.1, qty: 8, packSize: '5 L' },
  { slug: 'tomato-crushed', name: 'Murskatut tomaatit 2.5 kg', unit: 'KG', price: 1.8, qty: 30, packSize: '2.5 kg' },
  { slug: 'beans-white', name: 'Valkoiset pavut 2.5 kg', unit: 'KG', price: 2.2, qty: 12, packSize: '2.5 kg' },
  { slug: 'corn-can', name: 'Maissi tölkki 2.5 kg', unit: 'KG', price: 2.0, qty: 14, packSize: '2.5 kg' },
  { slug: 'broth-powder', name: 'Kasvisliemijauhe 1 kg', unit: 'KG', price: 9.5, qty: 3, packSize: '1 kg' },
  { slug: 'pepper-black', name: 'Mustapippuri jauhettu 500 g', unit: 'KG', price: 18, qty: 1.2, packSize: '500 g' },
  { slug: 'paprika', name: 'Paprikajauhe 500 g', unit: 'KG', price: 12, qty: 0.8, packSize: '500 g' },
  { slug: 'curry', name: 'Curryjauhe 500 g', unit: 'KG', price: 11, qty: 0.6, packSize: '500 g' },
  { slug: 'honey', name: 'Hunaja 5 kg', unit: 'KG', price: 7.5, qty: 5, packSize: '5 kg' },
  { slug: 'mustard', name: 'Sinappi 3 kg', unit: 'KG', price: 4.2, qty: 6, packSize: '3 kg' },
  { slug: 'ketchup', name: 'Ketsuppi 5 kg', unit: 'KG', price: 3.6, qty: 8, packSize: '5 kg' },
]);

const FREEZER = makeProducts('froz', 'place-fair-freezer', 'frozen', 'Freezer', [
  { slug: 'peas', name: 'Pakasteherneet 2.5 kg', unit: 'KG', price: 2.4, qty: 20, packSize: '2.5 kg' },
  { slug: 'corn-froz', name: 'Pakastemaissi 2.5 kg', unit: 'KG', price: 2.6, qty: 15, packSize: '2.5 kg' },
  { slug: 'spinach', name: 'Pakastespinatti 2.5 kg', unit: 'KG', price: 3.1, qty: 10, packSize: '2.5 kg' },
  { slug: 'berries-mix', name: 'Marjasekoitus 2.5 kg', unit: 'KG', price: 5.8, qty: 12, packSize: '2.5 kg' },
  { slug: 'strawberries', name: 'Pakastemandariinit 2.5 kg', unit: 'KG', price: 4.9, qty: 8, packSize: '2.5 kg' },
  { slug: 'fries', name: 'Uuniperunat 2.5 kg', unit: 'KG', price: 2.2, qty: 25, packSize: '2.5 kg' },
  { slug: 'fish-sticks', name: 'Kalapuikot 1 kg', unit: 'KG', price: 6.5, qty: 10, packSize: '1 kg' },
  { slug: 'salmon-portions', name: 'Lohipalat pakaste 1 kg', unit: 'KG', price: 14, qty: 8, packSize: '1 kg' },
  { slug: 'meatballs', name: 'Lihapullat pakaste 2 kg', unit: 'KG', price: 7.2, qty: 16, packSize: '2 kg' },
  { slug: 'chicken-nuggets', name: 'Kananuggetsit 2 kg', unit: 'KG', price: 6.8, qty: 12, packSize: '2 kg' },
  { slug: 'pizza-bases', name: 'Pizzapohjat 10 kpl', unit: 'KPL', price: 0.9, qty: 40 },
  { slug: 'ice-cream-van', name: 'Vaniljajäätelö 5 L', unit: 'L', price: 4.5, qty: 15, packSize: '5 L' },
  { slug: 'ice-cream-choc', name: 'Suklaajäätelö 5 L', unit: 'L', price: 4.5, qty: 10, packSize: '5 L' },
  { slug: 'pastry-dough', name: 'Voitaikinalevyt 1 kg', unit: 'KG', price: 5.2, qty: 6, packSize: '1 kg' },
  { slug: 'bread-rolls', name: 'Sämpylät pakaste 50 kpl', unit: 'KPL', price: 0.35, qty: 100 },
  { slug: 'soup-tomato', name: 'Tomaattikeitto pakaste 2 kg', unit: 'KG', price: 3.8, qty: 8, packSize: '2 kg' },
  { slug: 'soup-potato', name: 'Perunakeitto pakaste 2 kg', unit: 'KG', price: 3.5, qty: 8, packSize: '2 kg' },
  { slug: 'waffles', name: 'Vohvelit pakaste 1 kg', unit: 'KG', price: 4.1, qty: 5, packSize: '1 kg' },
  { slug: 'herbs-mix', name: 'Yrttisekoitus pakaste 500 g', unit: 'KG', price: 9.0, qty: 2, packSize: '500 g' },
  { slug: 'garlic-bread', name: 'Valkosipulileipä pakaste 20 kpl', unit: 'KPL', price: 0.55, qty: 40 },
]);

const VEG = makeProducts('veg', 'place-fair-veg', 'produce', 'Vegetables', [
  { slug: 'potato', name: 'Peruna 10 kg', unit: 'KG', price: 0.9, qty: 50, packSize: '10 kg' },
  { slug: 'carrot', name: 'Porkkana 5 kg', unit: 'KG', price: 1.2, qty: 25, packSize: '5 kg' },
  { slug: 'onion', name: 'Sipuli 5 kg', unit: 'KG', price: 1.0, qty: 20, packSize: '5 kg' },
  { slug: 'tomato', name: 'Tomaatti 5 kg', unit: 'KG', price: 3.5, qty: 15, packSize: '5 kg' },
  { slug: 'cucumber', name: 'Kurkku 5 kg', unit: 'KG', price: 2.8, qty: 12, packSize: '5 kg' },
  { slug: 'lettuce', name: 'Jäävuorisalaatti 1 kg', unit: 'KG', price: 2.2, qty: 10, packSize: '1 kg' },
  { slug: 'cabbage', name: 'Keräkaali 5 kg', unit: 'KG', price: 1.1, qty: 15, packSize: '5 kg' },
  { slug: 'broccoli', name: 'Broccoli 2 kg', unit: 'KG', price: 3.8, qty: 8, packSize: '2 kg' },
  { slug: 'cauliflower', name: 'Kukkakaali 2 kg', unit: 'KG', price: 3.2, qty: 6, packSize: '2 kg' },
  { slug: 'pepper-mix', name: 'Paprika sekoitus 2 kg', unit: 'KG', price: 4.5, qty: 8, packSize: '2 kg' },
  { slug: 'zucchini', name: 'Kesäkurpitsa 2 kg', unit: 'KG', price: 2.9, qty: 6, packSize: '2 kg' },
  { slug: 'eggplant', name: 'Munakoiso 2 kg', unit: 'KG', price: 3.4, qty: 4, packSize: '2 kg' },
  { slug: 'mushroom', name: 'Herkkusieni 1 kg', unit: 'KG', price: 5.5, qty: 5, packSize: '1 kg' },
  { slug: 'garlic', name: 'Valkosipuli 1 kg', unit: 'KG', price: 6.0, qty: 2, packSize: '1 kg' },
  { slug: 'leek', name: 'Purjo 2 kg', unit: 'KG', price: 2.5, qty: 6, packSize: '2 kg' },
  { slug: 'celery', name: 'Selleri 2 kg', unit: 'KG', price: 2.0, qty: 4, packSize: '2 kg' },
  { slug: 'beetroot', name: 'Punajuuri 5 kg', unit: 'KG', price: 1.4, qty: 10, packSize: '5 kg' },
  { slug: 'radish', name: 'Retiisi 1 kg', unit: 'KG', price: 3.0, qty: 3, packSize: '1 kg' },
  { slug: 'herbs-fresh', name: 'Tuoreet yrtit nippu', unit: 'KPL', price: 1.8, qty: 24 },
  { slug: 'lemon', name: 'Sitruuna 1 kg', unit: 'KG', price: 2.6, qty: 4, packSize: '1 kg' },
]);

const CLEAN = makeProducts('clean', 'place-fair-cleaning', 'other', 'Cleaning cabinet', [
  { slug: 'dish-soap', name: 'Astianpesuaine 5 L', unit: 'L', price: 3.2, qty: 15, packSize: '5 L' },
  { slug: 'rinse-aid', name: 'Huuhteenapuaine 5 L', unit: 'L', price: 4.1, qty: 8, packSize: '5 L' },
  { slug: 'surface-cleaner', name: 'Pintadesinfiointiaine 5 L', unit: 'L', price: 5.5, qty: 10, packSize: '5 L' },
  { slug: 'floor-cleaner', name: 'Lattianpesuaine 5 L', unit: 'L', price: 3.8, qty: 8, packSize: '5 L' },
  { slug: 'bleach', name: 'Kloori 5 L', unit: 'L', price: 2.9, qty: 6, packSize: '5 L' },
  { slug: 'hand-soap', name: 'Käsisaippua 5 L', unit: 'L', price: 4.0, qty: 10, packSize: '5 L' },
  { slug: 'hand-sanitizer', name: 'Käsihuuhde 5 L', unit: 'L', price: 6.5, qty: 8, packSize: '5 L' },
  { slug: 'paper-towel', name: 'Talouspaperi 6 rll', unit: 'PKT', price: 8.5, qty: 20 },
  { slug: 'toilet-paper', name: 'WC-paperi 24 rll', unit: 'PKT', price: 12, qty: 10 },
  { slug: 'napkins', name: 'Lautasliinat 1000 kpl', unit: 'PKT', price: 15, qty: 8 },
  { slug: 'trash-bags', name: 'Roskapussit 200 L 50 kpl', unit: 'PKT', price: 18, qty: 12 },
  { slug: 'gloves', name: 'Kertakäyttökäsineet L 100 kpl', unit: 'PKT', price: 9.5, qty: 15 },
  { slug: 'sponge', name: 'Pesusienet 10 kpl', unit: 'PKT', price: 4.2, qty: 6 },
  { slug: 'scrub-pad', name: 'Karhunkieli 10 kpl', unit: 'PKT', price: 5.0, qty: 4 },
  { slug: 'oven-cleaner', name: 'Uuninpuhdistusaine 1 L', unit: 'L', price: 7.8, qty: 4, packSize: '1 L' },
  { slug: 'glass-cleaner', name: 'Ikkunanpesuaine 1 L', unit: 'L', price: 3.5, qty: 5, packSize: '1 L' },
  { slug: 'foil', name: 'Alumiinifolio 30 cm 150 m', unit: 'PKT', price: 14, qty: 6 },
  { slug: 'cling-film', name: 'Kelmu 30 cm 300 m', unit: 'PKT', price: 11, qty: 8 },
  { slug: 'baking-paper', name: 'Leivinpaperi 38 cm 100 m', unit: 'PKT', price: 13, qty: 5 },
  { slug: 'mop-heads', name: 'Moppipäät 5 kpl', unit: 'PKT', price: 16, qty: 3 },
]);

const DAIRY = makeProducts('dairy', 'place-fair-dairy', 'dairy', 'Dairy', [
  { slug: 'milk-lowfat', name: 'Kevytmaito 10 L', unit: 'L', price: 0.95, qty: 40, packSize: '10 L' },
  { slug: 'milk-whole', name: 'Täysmaito 10 L', unit: 'L', price: 1.05, qty: 20, packSize: '10 L' },
  { slug: 'cream-cooking', name: 'Ruokakerma 15% 5 L', unit: 'L', price: 3.8, qty: 15, packSize: '5 L' },
  { slug: 'cream-whipping', name: 'Vispikerma 5 L', unit: 'L', price: 5.2, qty: 8, packSize: '5 L' },
  { slug: 'sour-cream', name: 'Smetana 2 kg', unit: 'KG', price: 4.5, qty: 6, packSize: '2 kg' },
  { slug: 'creme-fraiche', name: 'Crème fraîche 2 kg', unit: 'KG', price: 5.8, qty: 4, packSize: '2 kg' },
  { slug: 'butter', name: 'Voita 5 kg', unit: 'KG', price: 8.9, qty: 10, packSize: '5 kg' },
  { slug: 'margarine', name: 'Margariini 5 kg', unit: 'KG', price: 3.2, qty: 8, packSize: '5 kg' },
  { slug: 'yoghurt-natural', name: 'Luonnollinen jogurtti 5 kg', unit: 'KG', price: 2.4, qty: 12, packSize: '5 kg' },
  { slug: 'yoghurt-greek', name: 'Kreikkalainen jogurtti 2 kg', unit: 'KG', price: 4.1, qty: 6, packSize: '2 kg' },
  { slug: 'cheese-edam', name: 'Edam juusto 3 kg', unit: 'KG', price: 7.5, qty: 9, packSize: '3 kg' },
  { slug: 'cheese-gouda', name: 'Gouda juusto 3 kg', unit: 'KG', price: 8.2, qty: 6, packSize: '3 kg' },
  { slug: 'cheese-mozarella', name: 'Mozzarella 2 kg', unit: 'KG', price: 6.8, qty: 8, packSize: '2 kg' },
  { slug: 'cheese-feta', name: 'Feta 1 kg', unit: 'KG', price: 9.5, qty: 4, packSize: '1 kg' },
  { slug: 'cheese-grated', name: 'Raastettu juusto 2 kg', unit: 'KG', price: 7.0, qty: 10, packSize: '2 kg' },
  { slug: 'eggs', name: 'Kananmunat M 30 kpl', unit: 'KPL', price: 0.28, qty: 180 },
  { slug: 'quark', name: 'Rahka 2 kg', unit: 'KG', price: 3.6, qty: 6, packSize: '2 kg' },
  { slug: 'cottage-cheese', name: 'Raejuusto 2 kg', unit: 'KG', price: 4.0, qty: 5, packSize: '2 kg' },
  { slug: 'cream-cheese', name: 'Tuorejuusto 1 kg', unit: 'KG', price: 6.5, qty: 4, packSize: '1 kg' },
  { slug: 'oat-drink', name: 'Kaurajuoma 10 L', unit: 'L', price: 1.4, qty: 20, packSize: '10 L' },
]);

const MEATS = makeProducts('meat', 'place-fair-meats', 'meat', 'Meats', [
  { slug: 'beef-mince', name: 'Naudan jauheliha 10% 5 kg', unit: 'KG', price: 9.5, qty: 15, packSize: '5 kg' },
  { slug: 'pork-beef-mince', name: 'Sika-naudan jauheliha 5 kg', unit: 'KG', price: 7.2, qty: 20, packSize: '5 kg' },
  { slug: 'chicken-breast', name: 'Kananfilee 5 kg', unit: 'KG', price: 8.8, qty: 18, packSize: '5 kg' },
  { slug: 'chicken-thigh', name: 'Kanankoipi 5 kg', unit: 'KG', price: 5.5, qty: 12, packSize: '5 kg' },
  { slug: 'pork-loin', name: 'Porsaanulkofilee 5 kg', unit: 'KG', price: 7.8, qty: 10, packSize: '5 kg' },
  { slug: 'beef-roast', name: 'Naudan paisti 5 kg', unit: 'KG', price: 12, qty: 8, packSize: '5 kg' },
  { slug: 'sausage-grill', name: 'Grillimakkara 3 kg', unit: 'KG', price: 5.2, qty: 9, packSize: '3 kg' },
  { slug: 'sausage-lenkki', name: 'Lenkkimakkara 3 kg', unit: 'KG', price: 4.8, qty: 6, packSize: '3 kg' },
  { slug: 'bacon', name: 'Pekoni 2 kg', unit: 'KG', price: 8.5, qty: 5, packSize: '2 kg' },
  { slug: 'ham-cooked', name: 'Keittokinkku 3 kg', unit: 'KG', price: 7.0, qty: 6, packSize: '3 kg' },
  { slug: 'turkey-slices', name: 'Kalkkunaleikkele 1 kg', unit: 'KG', price: 9.0, qty: 4, packSize: '1 kg' },
  { slug: 'salami', name: 'Salami 1 kg', unit: 'KG', price: 11, qty: 3, packSize: '1 kg' },
  { slug: 'meatballs-fresh', name: 'Tuoreet lihapullat 3 kg', unit: 'KG', price: 6.5, qty: 9, packSize: '3 kg' },
  { slug: 'liver-pate', name: 'Maksapasteija 1 kg', unit: 'KG', price: 5.5, qty: 3, packSize: '1 kg' },
  { slug: 'salmon-fresh', name: 'Tuore lohi 5 kg', unit: 'KG', price: 16, qty: 8, packSize: '5 kg' },
  { slug: 'whitefish', name: 'Siika / seiti 3 kg', unit: 'KG', price: 9.5, qty: 5, packSize: '3 kg' },
  { slug: 'shrimp', name: 'Katkarapu 1 kg', unit: 'KG', price: 14, qty: 4, packSize: '1 kg' },
  { slug: 'tuna-can', name: 'Tonnikala öljyssä 1.7 kg', unit: 'KG', price: 8.2, qty: 6, packSize: '1.7 kg' },
  { slug: 'chicken-wings', name: 'Kanansiivet 5 kg', unit: 'KG', price: 4.9, qty: 10, packSize: '5 kg' },
  { slug: 'ribs', name: 'Porsaan kylki 5 kg', unit: 'KG', price: 6.8, qty: 8, packSize: '5 kg' },
]);

export const FAIR_BUFFET_PRODUCTS: Product[] = [
  ...DRY.products,
  ...FREEZER.products,
  ...VEG.products,
  ...CLEAN.products,
  ...DAIRY.products,
  ...MEATS.products,
];

export const FAIR_BUFFET_STOCK: FairBuffetStockRow[] = [
  ...DRY.stock,
  ...FREEZER.stock,
  ...VEG.stock,
  ...CLEAN.stock,
  ...DAIRY.stock,
  ...MEATS.stock,
];

export function isFairBuffetVenue(raw: string | null | undefined): boolean {
  const v = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!v) return false;
  return (
    v.includes('fair buffet') ||
    v.includes('messukeskus') ||
    v === 'fair buffet · messukeskus'
  );
}
