import type { Place, Product, UnitCode } from './types';

/** Investor walkthrough — catering buffet sample kitchen */
export const INVESTOR_SITE_NAME = 'Investor demo · Catering buffet';

/** v2: 20 SKUs × storage filter (Dry / Freezer / Prep fridge / Drawers). */
export const INVESTOR_BUFFET_SEED_VERSION = 'investor-buffet.v2';

export const INVESTOR_BUFFET_SEED_PLACES: Place[] = [
  {
    id: 'place-inv-dry',
    name: 'Dry storage',
    kind: 'pantry',
    storageType: 'dry_storage',
    sortOrder: 0,
  },
  {
    id: 'place-inv-freezer',
    name: 'Freezer',
    kind: 'freezer',
    storageType: 'freezer',
    sortOrder: 1,
  },
  {
    id: 'place-inv-fridge',
    name: 'Prep fridge',
    kind: 'kitchen',
    storageType: 'prep_fridge',
    sortOrder: 2,
  },
  {
    id: 'place-inv-drawers',
    name: 'Drawers',
    kind: 'other',
    storageType: 'drawers',
    sortOrder: 3,
  },
];

export type InvestorStockRow = {
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

const DRY_PLACE = 'place-inv-dry';
const FREEZER_PLACE = 'place-inv-freezer';
const FRIDGE_PLACE = 'place-inv-fridge';
const DRAWERS_PLACE = 'place-inv-drawers';

function makeProducts(
  prefix: string,
  placeId: string,
  ingredientType: Product['ingredientType'],
  section: string,
  specs: Spec[],
): { products: Product[]; stock: InvestorStockRow[] } {
  const products: Product[] = [];
  const stock: InvestorStockRow[] = [];
  specs.forEach((s, i) => {
    const id = `inv-${prefix}-${String(i + 1).padStart(2, '0')}-${s.slug}`;
    products.push({
      id,
      officialName: s.name,
      unit: s.unit,
      packSize: s.packSize,
      unitPriceAlv0: s.price,
      ingredientType,
      section,
      aliases: s.aliases ?? [s.slug.replace(/-/g, ' ')],
      productCode: `IV${prefix.toUpperCase()}${String(i + 1).padStart(3, '0')}`,
    });
    stock.push({ productId: id, placeId, quantity: s.qty });
  });
  return { products, stock };
}

/** Exactly 20 catering SKUs per storage type (matches Inventory storage filter). */
const DRY = makeProducts('dry', DRY_PLACE, 'dry_goods', 'Dry storage', [
  { slug: 'pasta-penne', name: 'Barilla penne 5 kg', unit: 'KG', price: 3.2, qty: 25, packSize: '5 kg' },
  { slug: 'pasta-spaghetti', name: 'Barilla spaghetti 5 kg', unit: 'KG', price: 3.1, qty: 20, packSize: '5 kg' },
  { slug: 'rice-jasmin', name: 'Jasminriisi 5 kg', unit: 'KG', price: 2.8, qty: 30, packSize: '5 kg' },
  { slug: 'rice-risotto', name: 'Risottoriisi Arborio 1 kg', unit: 'KG', price: 4.5, qty: 10, packSize: '1 kg' },
  { slug: 'flour', name: 'Vehnäjauho 10 kg', unit: 'KG', price: 0.85, qty: 40, packSize: '10 kg' },
  { slug: 'sugar', name: 'Hienosokeri 5 kg', unit: 'KG', price: 1.1, qty: 15, packSize: '5 kg' },
  { slug: 'salt', name: 'Hieno ruokasuola 1 kg', unit: 'KG', price: 0.6, qty: 8, packSize: '1 kg' },
  { slug: 'couscous', name: 'Kuskus 5 kg', unit: 'KG', price: 2.9, qty: 12, packSize: '5 kg' },
  { slug: 'oil-rapeseed', name: 'Rypsiöljy 10 L', unit: 'L', price: 2.4, qty: 40, packSize: '10 L' },
  { slug: 'oil-olive', name: 'Oliiviöljy 5 L', unit: 'L', price: 8.9, qty: 12, packSize: '5 L' },
  { slug: 'vinegar', name: 'Valkoviinietikka 5 L', unit: 'L', price: 2.1, qty: 8, packSize: '5 L' },
  { slug: 'tomato-crushed', name: 'Murskatut tomaatit 2.5 kg', unit: 'KG', price: 1.8, qty: 30, packSize: '2.5 kg' },
  { slug: 'beans', name: 'Valkoiset pavut 2.5 kg', unit: 'KG', price: 2.2, qty: 12, packSize: '2.5 kg' },
  { slug: 'chickpea', name: 'Kikherneet 2.5 kg', unit: 'KG', price: 2.4, qty: 12, packSize: '2.5 kg' },
  { slug: 'broth', name: 'Kasvisliemijauhe 1 kg', unit: 'KG', price: 9.5, qty: 4, packSize: '1 kg' },
  { slug: 'mayo', name: 'Majoneesi 5 L', unit: 'L', price: 4.2, qty: 10, packSize: '5 L' },
  { slug: 'mustard', name: 'Sinappi 3 kg', unit: 'KG', price: 4.2, qty: 6, packSize: '3 kg' },
  { slug: 'ketchup', name: 'Ketsuppi 5 kg', unit: 'KG', price: 3.6, qty: 8, packSize: '5 kg' },
  { slug: 'honey', name: 'Hunaja 5 kg', unit: 'KG', price: 7.5, qty: 5, packSize: '5 kg' },
  { slug: 'soy', name: 'Soijakastike 5 L', unit: 'L', price: 3.8, qty: 6, packSize: '5 L' },
]);

const FREEZER = makeProducts('froz', FREEZER_PLACE, 'frozen', 'Freezer', [
  { slug: 'peas', name: 'Pakasteherneet 2.5 kg', unit: 'KG', price: 2.4, qty: 20, packSize: '2.5 kg' },
  { slug: 'corn', name: 'Pakastemaissi 2.5 kg', unit: 'KG', price: 2.6, qty: 15, packSize: '2.5 kg' },
  { slug: 'spinach', name: 'Pakastespinatti 2.5 kg', unit: 'KG', price: 3.1, qty: 10, packSize: '2.5 kg' },
  { slug: 'broccoli', name: 'Pakasteparsakaali 2.5 kg', unit: 'KG', price: 3.0, qty: 10, packSize: '2.5 kg' },
  { slug: 'berries', name: 'Marjasekoitus 2.5 kg', unit: 'KG', price: 4.8, qty: 12, packSize: '2.5 kg' },
  { slug: 'fries', name: 'Ranskanperunat 2.5 kg', unit: 'KG', price: 2.9, qty: 25, packSize: '2.5 kg' },
  { slug: 'falafel', name: 'Falafelpihvi 2 kg', unit: 'KG', price: 6.5, qty: 10, packSize: '2 kg' },
  { slug: 'meatballs', name: 'Lihapullat pakaste 2 kg', unit: 'KG', price: 7.2, qty: 16, packSize: '2 kg' },
  { slug: 'nuggets', name: 'Kananuggetsit 2 kg', unit: 'KG', price: 6.8, qty: 12, packSize: '2 kg' },
  { slug: 'pastry', name: 'Voitaikinalevy 1 kg', unit: 'KG', price: 5.8, qty: 8, packSize: '1 kg' },
  { slug: 'shrimp', name: 'Pakastekatkarapu 1 kg', unit: 'KG', price: 12, qty: 8, packSize: '1 kg' },
  { slug: 'salmon', name: 'Lohipalat pakaste 1 kg', unit: 'KG', price: 14, qty: 8, packSize: '1 kg' },
  { slug: 'ice', name: 'Jääkuutiot 5 kg', unit: 'KG', price: 1.2, qty: 20, packSize: '5 kg' },
  { slug: 'ice-cream', name: 'Vaniljajäätelö 5 L', unit: 'L', price: 4.5, qty: 10, packSize: '5 L' },
  { slug: 'rolls', name: 'Sämpylät pakaste 50 kpl', unit: 'KPL', price: 0.35, qty: 100 },
  { slug: 'pizza', name: 'Pizzapohjat 10 kpl', unit: 'KPL', price: 0.9, qty: 40 },
  { slug: 'soup-tomato', name: 'Tomaattikeitto pakaste 2 kg', unit: 'KG', price: 3.8, qty: 8, packSize: '2 kg' },
  { slug: 'waffles', name: 'Vohvelit pakaste 1 kg', unit: 'KG', price: 4.1, qty: 5, packSize: '1 kg' },
  { slug: 'garlic-bread', name: 'Valkosipulileipä pakaste 20 kpl', unit: 'KPL', price: 0.55, qty: 40 },
  { slug: 'herbs-froz', name: 'Yrttisekoitus pakaste 500 g', unit: 'KG', price: 9.0, qty: 2, packSize: '500 g' },
]);

const FRIDGE = makeProducts('fridge', FRIDGE_PLACE, 'produce', 'Prep fridge', [
  { slug: 'potato', name: 'Peruna 10 kg', unit: 'KG', price: 0.9, qty: 40, packSize: '10 kg' },
  { slug: 'onion', name: 'Sipuli 5 kg', unit: 'KG', price: 1.0, qty: 15, packSize: '5 kg' },
  { slug: 'carrot', name: 'Porkkana 5 kg', unit: 'KG', price: 1.2, qty: 12, packSize: '5 kg' },
  { slug: 'tomato', name: 'Tomaatti 5 kg', unit: 'KG', price: 3.5, qty: 10, packSize: '5 kg' },
  { slug: 'cucumber', name: 'Kurkku 5 kg', unit: 'KG', price: 2.8, qty: 8, packSize: '5 kg' },
  { slug: 'lettuce', name: 'Jäävuorisalaatti 1 kg', unit: 'KG', price: 2.2, qty: 10, packSize: '1 kg' },
  { slug: 'pepper', name: 'Paprika sekoitus 2 kg', unit: 'KG', price: 4.5, qty: 6, packSize: '2 kg' },
  { slug: 'herbs', name: 'Tuoreet yrtit nippu', unit: 'KPL', price: 1.8, qty: 20 },
  { slug: 'milk', name: 'Kevytmaito 10 L', unit: 'L', price: 0.95, qty: 30, packSize: '10 L' },
  { slug: 'cream', name: 'Ruokakerma 15% 5 L', unit: 'L', price: 3.8, qty: 12, packSize: '5 L' },
  { slug: 'butter', name: 'Voita 5 kg', unit: 'KG', price: 8.9, qty: 10, packSize: '5 kg' },
  { slug: 'eggs', name: 'Kananmunat L 30 kpl', unit: 'KPL', price: 0.32, qty: 120 },
  { slug: 'edam', name: 'Edam juusto 3 kg', unit: 'KG', price: 7.5, qty: 8, packSize: '3 kg' },
  { slug: 'feta', name: 'Fetajuusto 1 kg', unit: 'KG', price: 8.5, qty: 5, packSize: '1 kg' },
  { slug: 'beef-mince', name: 'Naudan jauheliha 10% 5 kg', unit: 'KG', price: 9.5, qty: 15, packSize: '5 kg' },
  { slug: 'chicken', name: 'Kanankoipi / filee 5 kg', unit: 'KG', price: 7.5, qty: 20, packSize: '5 kg' },
  { slug: 'ham', name: 'Kinkku ohut 1 kg', unit: 'KG', price: 9.5, qty: 6, packSize: '1 kg' },
  { slug: 'salmon-fresh', name: 'Lohifileé tuore 5 kg', unit: 'KG', price: 16, qty: 10, packSize: '5 kg' },
  { slug: 'hummus', name: 'Hummus 2 kg', unit: 'KG', price: 5.8, qty: 6, packSize: '2 kg' },
  { slug: 'yoghurt', name: 'Luonnollinen jogurtti 5 kg', unit: 'KG', price: 2.4, qty: 8, packSize: '5 kg' },
]);

const DRAWERS = makeProducts('draw', DRAWERS_PLACE, 'other', 'Drawers', [
  { slug: 'dish-soap', name: 'Astianpesuaine 5 L', unit: 'L', price: 3.2, qty: 15, packSize: '5 L' },
  { slug: 'surface', name: 'Pintadesinfiointiaine 5 L', unit: 'L', price: 5.5, qty: 10, packSize: '5 L' },
  { slug: 'hand-soap', name: 'Käsisaippua 5 L', unit: 'L', price: 4.0, qty: 10, packSize: '5 L' },
  { slug: 'sanitizer', name: 'Käsihuuhde 5 L', unit: 'L', price: 6.5, qty: 8, packSize: '5 L' },
  { slug: 'paper-towel', name: 'Talouspaperi 6 rll', unit: 'PKT', price: 8.5, qty: 20 },
  { slug: 'napkins', name: 'Lautasliinat 1000 kpl', unit: 'PKT', price: 15, qty: 8 },
  { slug: 'trash-bags', name: 'Roskapussit 200 L 50 kpl', unit: 'PKT', price: 18, qty: 12 },
  { slug: 'gloves', name: 'Kertakäyttökäsineet L 100 kpl', unit: 'PKT', price: 9.5, qty: 15 },
  { slug: 'foil', name: 'Alumiinifolio 30 cm 150 m', unit: 'PKT', price: 14, qty: 6 },
  { slug: 'cling', name: 'Kelmu 30 cm 300 m', unit: 'PKT', price: 11, qty: 8 },
  { slug: 'baking-paper', name: 'Leivinpaperi 38 cm 100 m', unit: 'PKT', price: 13, qty: 5 },
  { slug: 'sponge', name: 'Pesusienet 10 kpl', unit: 'PKT', price: 4.2, qty: 6 },
  { slug: 'scrub', name: 'Karhunkieli 10 kpl', unit: 'PKT', price: 5.0, qty: 4 },
  { slug: 'oven-cleaner', name: 'Uuninpuhdistusaine 1 L', unit: 'L', price: 7.8, qty: 4, packSize: '1 L' },
  { slug: 'floor', name: 'Lattianpesuaine 5 L', unit: 'L', price: 3.8, qty: 8, packSize: '5 L' },
  { slug: 'coffee', name: 'Suodatin kahvi 1 kg', unit: 'KG', price: 8.5, qty: 5, packSize: '1 kg' },
  { slug: 'tea', name: 'Tee pussi 100 kpl', unit: 'PKT', price: 4.2, qty: 6 },
  { slug: 'wrap-kit', name: 'Kelmu / foliopaketti', unit: 'PKT', price: 2.8, qty: 15 },
  { slug: 'toothpicks', name: 'Hammastikut 1000 kpl', unit: 'PKT', price: 3.5, qty: 10 },
  { slug: 'labels', name: 'Päiväystarrat rulla', unit: 'PKT', price: 6.0, qty: 8 },
]);

const ALL = [DRY, FREEZER, FRIDGE, DRAWERS];

export const INVESTOR_BUFFET_PRODUCTS: Product[] = ALL.flatMap((b) => b.products);
export const INVESTOR_BUFFET_STOCK: InvestorStockRow[] = ALL.flatMap((b) => b.stock);

export function isInvestorBuffetVenue(raw: string | null | undefined): boolean {
  const v = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!v) return false;
  return (
    v.includes('investor demo') ||
    v.includes('catering buffet') ||
    v === 'investor'
  );
}

/** True when v2 storage-filter seed is present (Drawers / `inv-draw-`). */
export function hasInvestorBuffetSeed(products: Product[]): boolean {
  return products.some((p) => p.id.startsWith('inv-draw-'));
}
