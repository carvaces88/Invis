/**
 * K-Ruoka (www.k-ruoka.fi) public retail product seed — sauces + grocery staples.
 *
 * Source: public K-Ruoka product listings / screenshots (names, pack size, shelf €).
 * Prices stored as unitPriceAlv0 = shelf€ / 1.14 (food ALV), matching seedBuffet.
 * Official pack photos for mayo are bundled under assets/demo/; other SKUs skip
 * imageUrl (CDN often Cloudflare-gated). Prefer scripts/fetch-kruoka.ts when stable.
 *
 * Naming: Finnish sentence-case officialName + English aliases (no nameEn field).
 * Attribution: inspired by K-Ruoka public catalog. Not affiliated with Kesko.
 */
import { Image } from 'react-native';
import type { Product } from './types';

/** Bundled packshot (from public K-Ruoka product page screenshot, cropped). */
export const KRUOKA_PACK_IMAGES: Record<string, number> = {
  'kruoka-herkkumaa-taysmajoneesi-5kg': require('../../assets/demo/herkkumaa-taysmajoneesi-5kg-pack.png'),
  'kruoka-atria-rahkaohukainen-kaakao-vadelma-380g': require('../../assets/demo/atria-rahkaohukainen-kaakao-vadelma-380g-pack.png'),
};

/** Demo walk-in / shelf photos used by fridge panorama stub. */
export const DEMO_SHELF_PHOTOS = {
  mayo1: require('../../assets/demo/shelf-mayo-1.png'),
  mayo2: require('../../assets/demo/shelf-mayo-2.png'),
} as const;

export function resolveDemoShelfUri(
  key: keyof typeof DEMO_SHELF_PHOTOS = 'mayo1',
): string {
  const resolved = Image.resolveAssetSource(DEMO_SHELF_PHOTOS[key]);
  return resolved?.uri ?? '';
}

export function productImageSource(product: Product) {
  const local = KRUOKA_PACK_IMAGES[product.id];
  if (local != null) return local;
  if (product.imageUrl) return { uri: product.imageUrl };
  return null;
}

/**
 * Normalized crop (0–1) focusing Herkkumaa täysmajoneesi 5 kg white bucket
 * on assets/demo/shelf-mayo-1.png (portrait walk-in shelf).
 */
export const DEMO_MAYO_CROP = {
  x: 0.22,
  y: 0.42,
  width: 0.34,
  height: 0.17,
  previewColor: '#E8EEF5',
} as const;

/** Second shelf photo — slightly wider bucket focus. */
export const DEMO_MAYO_CROP_SHELF2 = {
  x: 0.08,
  y: 0.46,
  width: 0.42,
  height: 0.14,
  previewColor: '#E8EEF5',
} as const;

/**
 * Prices: K-Ruoka consumer shelf € (incl. 14% food ALV) ÷ 1.14 → unitPriceAlv0.
 * Names: Finnish retail officialName (sentence case) + EN aliases for search.
 * Distinct commercial SKUs kept separate from generic buffet/catalog lines
 * (e.g. porkkana kg, kikherne, fetajuusto kg, korianteri nippu).
 */
export const SEED_KRUOKA_PRODUCTS: Product[] = [
  {
    id: 'kruoka-herkkumaa-taysmajoneesi-5kg',
    officialName: 'Herkkumaa täysmajoneesi 5 kg',
    unit: 'PRK',
    packSize: '5 kg',
    unitPriceAlv0: 18.5,
    ingredientType: 'sauces',
    section: 'K-Ruoka · sauces',
    isTop: true,
    lowStockThreshold: 1,
    ean: '6411300002355',
    sourceUrl:
      'https://www.k-ruoka.fi/kauppa/tuote/herkkumaa-taysmajoneesi-5kg-6411300002355',
    // Live CDN may 403; UI falls back to bundled packshot via KRUOKA_PACK_IMAGES.
    imageUrl:
      'https://www.k-ruoka.fi/kauppa/tuote/herkkumaa-taysmajoneesi-5kg-6411300002355',
    aliases: [
      'herkkumaa täysmajoneesi',
      'herkkumaa taysmajoneesi',
      'täysmajoneesi',
      'taysmajoneesi',
      'herkkumaa mayo',
      'herkkumaa mayonnaise',
      'full mayonnaise 5kg',
      'herkkumaa 5kg',
      'täys-majoneesi',
    ],
  },
  {
    id: 'kruoka-herkkumaa-kevytmajoneesi-5kg',
    officialName: 'Herkkumaa kevytmajoneesi 5 kg',
    unit: 'PRK',
    packSize: '5 kg',
    unitPriceAlv0: 17.9,
    ingredientType: 'sauces',
    section: 'K-Ruoka · sauces',
    aliases: [
      'herkkumaa kevytmajoneesi',
      'kevytmajoneesi',
      'light mayonnaise',
      'herkkumaa light mayo',
    ],
  },
  {
    id: 'kruoka-felix-majoneesi',
    officialName: 'Felix majoneesi',
    unit: 'PRK',
    unitPriceAlv0: 2.4,
    ingredientType: 'sauces',
    section: 'K-Ruoka · sauces',
    aliases: ['felix mayo', 'felix majoneesi', 'felix mayonnaise'],
  },
  {
    id: 'kruoka-maille-dijon',
    officialName: 'Maille Dijon -sinappi',
    unit: 'PRK',
    packSize: '215 g',
    unitPriceAlv0: 3.2,
    ingredientType: 'sauces',
    section: 'K-Ruoka · sauces',
    aliases: ['maille', 'dijon', 'dijon mustard', 'maille sinappi'],
  },
  {
    id: 'kruoka-herkkumaa-sinappimajoneesi',
    officialName: 'Herkkumaa sinappimajoneesi 5 kg',
    unit: 'PRK',
    packSize: '5 kg',
    unitPriceAlv0: 18.2,
    ingredientType: 'sauces',
    section: 'K-Ruoka · sauces',
    aliases: [
      'sinappimajoneesi',
      'herkkumaa sinappi',
      'mustard mayo',
      'mustard mayonnaise',
    ],
  },

  // --- Retail produce (batch 1–2) ---
  {
    id: 'kruoka-pirkka-pesty-porkkana-1kg',
    officialName: 'Pirkka suomalainen pesty porkkana 1 kg',
    unit: 'KPL',
    packSize: '1 kg',
    unitPriceAlv0: 1.66,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: [
      'pirkka porkkana',
      'pesty porkkana',
      'washed carrots',
      'pirkka carrots 1kg',
      'suomalainen porkkana',
    ],
  },
  {
    id: 'kruoka-pirkka-luomu-pesty-porkkana-1kg',
    officialName: 'Pirkka Luomu suomalainen pesty porkkana 1 kg',
    unit: 'KPL',
    packSize: '1 kg',
    unitPriceAlv0: 2.36,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: [
      'pirkka luomu porkkana',
      'organic washed carrots',
      'luomu porkkana 1kg',
      'organic carrots pirkka',
    ],
  },
  {
    id: 'kruoka-muumi-porkkana-600g',
    officialName: 'Muumi-porkkana 600 g',
    unit: 'KPL',
    packSize: '600 g',
    unitPriceAlv0: 1.66,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: [
      'muumi porkkana',
      'moomin carrot',
      'moomin-carrot',
      'muumi-carrots',
    ],
  },
  {
    id: 'kruoka-pirkka-sitruuna-luomu',
    officialName: 'Pirkka sitruuna luomu',
    unit: 'KPL',
    unitPriceAlv0: 0.7,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: [
      'pirkka sitruuna',
      'organic lemon',
      'luomu sitruuna',
      'pirkka lemon organic',
    ],
  },
  {
    id: 'kruoka-jarvikyla-korianteri-20g',
    officialName: 'Järvikylä korianteri 20 g',
    unit: 'RSA',
    packSize: '20 g',
    unitPriceAlv0: 2.27,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: [
      'järvikylä korianteri',
      'jarvikyla korianteri',
      'cilantro box',
      'järvikylä cilantro',
      'cilantro 20g',
      'fresh cilantro box',
      'tuore korianteri rasia',
    ],
  },
  {
    id: 'kruoka-pirkka-jaasalatti-100g',
    officialName: 'Pirkka jääsalaatti 100 g',
    unit: 'PSS',
    packSize: '100 g',
    unitPriceAlv0: 1.13,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: [
      'pirkka jääsalaatti',
      'pirkka ice lettuce',
      'iceberg bag',
      'jääsalaatti 100g',
      'ice lettuce 100g',
    ],
  },
  {
    id: 'kruoka-pirkka-rucola-luomu-65g',
    officialName: 'Pirkka rucola luomu 65 g',
    unit: 'PSS',
    packSize: '65 g',
    unitPriceAlv0: 1.57,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: [
      'pirkka rucola',
      'organic rocket',
      'arugula',
      'luomu rucola',
      'pirkka arugula',
    ],
  },
  {
    id: 'kruoka-lime-kpl',
    officialName: 'Lime',
    unit: 'KPL',
    unitPriceAlv0: 0.4,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: ['lime piece', 'lime kpl', 'single lime', 'limetti'],
  },
  {
    id: 'kruoka-lime-2-3kpl-220g',
    officialName: 'Lime 2–3 kpl / 220 g',
    unit: 'KPL',
    packSize: '2–3 kpl / 220 g',
    unitPriceAlv0: 1.92,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: [
      'lime pack',
      'lime 2-3',
      'limes 220g',
      'lime bag',
      'limetti pussi',
    ],
  },
  {
    id: 'kruoka-bataatti',
    officialName: 'Bataatti',
    unit: 'KPL',
    unitPriceAlv0: 1.18,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: ['sweet potato', 'bataatit', 'yam'],
  },
  {
    id: 'kruoka-bataatti-luomu',
    officialName: 'Bataatti luomu',
    unit: 'KPL',
    unitPriceAlv0: 2.37,
    ingredientType: 'produce',
    section: 'K-Ruoka · produce',
    aliases: [
      'organic sweet potato',
      'luomu bataatti',
      'organic bataatti',
    ],
  },

  // --- Dairy ---
  {
    id: 'kruoka-pirkka-parhaat-fetajuusto-150g',
    officialName: 'Pirkka Parhaat fetajuusto 150 g',
    unit: 'KPL',
    packSize: '150 g',
    unitPriceAlv0: 2.62,
    ingredientType: 'dairy',
    section: 'K-Ruoka · dairy',
    aliases: [
      'pirkka feta',
      'pirkka parhaat feta',
      'feta 150g',
      'fetajuusto vähälaktoosinen',
      'low lactose feta',
    ],
  },
  {
    id: 'kruoka-atria-rahkaohukainen-kaakao-vadelma-380g',
    officialName: 'Atria kaakao-vadelma rahkaohukainen 380 g',
    unit: 'KPL',
    packSize: '380 g',
    unitPriceAlv0: 2.36, // 2.69 € shelf ÷ 1.14 food ALV
    ingredientType: 'dairy',
    section: 'K-Ruoka · dairy',
    isTop: true,
    lowStockThreshold: 1,
    ean: '6407800019265',
    sourceUrl:
      'https://www.k-ruoka.fi/haku?q=atria%20kaakao&tuote=atria-rahkaohukainen-kaakao-vadelma-380g-6407800019265',
    imageUrl:
      'https://www.k-ruoka.fi/haku?q=atria%20kaakao&tuote=atria-rahkaohukainen-kaakao-vadelma-380g-6407800019265',
    aliases: [
      'atria rahkaohukainen',
      'atria kaakao-vadelma',
      'kaakao-vadelma rahkaohukainen',
      'kaakao vadelma rahkaohukainen',
      'kvargplättar kakao-hallon',
      'quark pancake cocoa raspberry',
      'atria quark pancake',
      'rahkaohukainen kaakao',
      '6407800019265',
    ],
  },
  {
    // Reference case: pack photo / barcode → official K-Ruoka fields
    id: 'kruoka-valio-tuuti2-vieroitusvalmiste-1l',
    officialName: 'Valio Tuuti2 vieroitusvalmiste 1l 6-12kk',
    unit: 'KPL',
    packSize: '1 L',
    unitPriceAlv0: 2.32, // 2.65 € shelf ÷ 1.14 food ALV
    ingredientType: 'dairy',
    section: 'K-Ruoka · dairy',
    isTop: true,
    lowStockThreshold: 1,
    ean: '6408430492312',
    sourceUrl:
      'https://www.k-ruoka.fi/haku?q=6408430492312',
    imageUrl:
      'https://public.keskofiles.com/f/k-ruoka/product/6408430492312',
    aliases: [
      'valio tuuti2',
      'valio tuuti 2',
      'tuuti2',
      'tuuti 2',
      'valio tuuti',
      'tuuti',
      'vieroitusvalmiste',
      'käyttövalmis maitopohjainen vieroitusvalmiste',
      'kayttovalmis maitopohjainen vieroitusvalmiste',
      'follow-on formula',
      'follow on formula',
      'baby formula',
      'infant formula',
      'ready to feed formula',
      'valio baby formula',
      'tuuti 1l',
      '6408430492312',
    ],
  },

  // --- Spices & salt ---
  {
    id: 'kruoka-pirkka-juustokumina-25g',
    officialName: 'Pirkka juustokumina jauhettu 25 g',
    unit: 'PSS',
    packSize: '25 g',
    unitPriceAlv0: 0.96,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'pirkka juustokumina',
      'pirkka cumin',
      'cumin ground 25g',
      'ground cumin pirkka',
      'cummin',
    ],
  },
  {
    id: 'kruoka-pirkka-luomu-juustokumina-27g',
    officialName: 'Pirkka Luomu juustokumina 27 g',
    unit: 'PSS',
    packSize: '27 g',
    unitPriceAlv0: 2.53,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'pirkka luomu juustokumina',
      'organic cumin',
      'luomu cumin',
      'pirkka organic cumin',
    ],
  },
  {
    id: 'kruoka-meira-juustokumina-25g',
    officialName: 'Meira juustokumina jauhettu 25 g',
    unit: 'PSS',
    packSize: '25 g',
    unitPriceAlv0: 1.13,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'meira juustokumina',
      'meira cumin',
      'cumin meira',
      'ground cumin meira',
    ],
  },
  {
    id: 'kruoka-pirkka-mustapippuri-21g',
    officialName: 'Pirkka mustapippuri kokonainen 21 g',
    unit: 'PSS',
    packSize: '21 g',
    unitPriceAlv0: 0.75,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'pirkka mustapippuri',
      'pirkka black pepper',
      'whole black pepper 21g',
      'peppercorns pirkka',
    ],
  },
  {
    id: 'kruoka-santa-maria-mustapippuri-22g',
    officialName: 'Santa Maria mustapippuri kokonainen 22 g',
    unit: 'PSS',
    packSize: '22 g',
    unitPriceAlv0: 1.26,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'santa maria mustapippuri',
      'svart peppar hel',
      'santa maria black pepper',
      'svart peppar',
      'whole black pepper santa maria',
    ],
  },
  {
    id: 'kruoka-meira-mustapippuri-27g',
    officialName: 'Meira mustapippuri kokonainen 27 g',
    unit: 'PSS',
    packSize: '27 g',
    unitPriceAlv0: 1.18,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'meira mustapippuri',
      'meira black pepper',
      'black peppercorns meira',
      'whole peppercorns 27g',
    ],
  },
  {
    id: 'kruoka-pirkka-paprikajauhe-25g',
    officialName: 'Pirkka paprikajauhe 25 g',
    unit: 'PSS',
    packSize: '25 g',
    unitPriceAlv0: 0.57,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'pirkka paprikajauhe',
      'pirkka paprika powder',
      'paprika powder 25g',
      'ground paprika pirkka',
    ],
  },
  {
    id: 'kruoka-meira-paprikajauhe-24g',
    officialName: 'Meira paprika jauhettu 24 g',
    unit: 'PSS',
    packSize: '24 g',
    unitPriceAlv0: 0.59,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'meira paprika',
      'meira paprikajauhe',
      'paprika powder meira',
      'ground paprika meira',
    ],
  },
  {
    id: 'kruoka-meira-paprikajauhe-savustettu-22g',
    officialName: 'Meira paprikajauhe savustettu 22 g',
    unit: 'PSS',
    packSize: '22 g',
    unitPriceAlv0: 1.18,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'meira savustettu paprika',
      'smoked paprika',
      'smoked paprika powder',
      'savustettu paprikajauhe',
    ],
  },
  {
    id: 'kruoka-jozo-poytasuola-125g',
    officialName: 'Jozo pöytäsuola jodioitu 125 g',
    unit: 'PKT',
    packSize: '125 g',
    unitPriceAlv0: 0.87,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'jozo pöytäsuola',
      'jozo table salt',
      'table salt 125g',
      'jozo salt 125g',
    ],
  },
  {
    id: 'kruoka-jozo-suola-600g',
    officialName: 'Jozo suola jodioitu 600 g',
    unit: 'PKT',
    packSize: '600 g',
    unitPriceAlv0: 1.62,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'jozo suola 600g',
      'jozo salt 600g',
      'iodized salt jozo',
      'jozo salt iodine',
    ],
  },
  {
    id: 'kruoka-pirkka-suola-1kg',
    officialName: 'Pirkka suola jodioitu 1 kg',
    unit: 'PKT',
    packSize: '1 kg',
    unitPriceAlv0: 1.04,
    ingredientType: 'dry_goods',
    section: 'K-Ruoka · spices',
    aliases: [
      'pirkka suola',
      'pirkka salt',
      'iodized salt 1kg',
      'pirkka salt iodine',
    ],
  },

  // --- Canned / jarred ---
  {
    id: 'kruoka-pirkka-kikherneet-380g',
    officialName: 'Pirkka kikherneitä suolaliemessä 380g/230g',
    unit: 'PRK',
    packSize: '380g/230g',
    unitPriceAlv0: 0.96,
    ingredientType: 'canned',
    section: 'K-Ruoka · canned',
    aliases: [
      'pirkka kikherneet',
      'pirkka chickpeas',
      'chickpeas in brine',
      'kikherneitä suolaliemessä',
    ],
  },
  {
    id: 'kruoka-pirkka-luomu-kikherneet-380g',
    officialName: 'Pirkka Luomu kikherneitä suolaliemessä 380g/230g',
    unit: 'PRK',
    packSize: '380g/230g',
    unitPriceAlv0: 0.87,
    ingredientType: 'canned',
    section: 'K-Ruoka · canned',
    aliases: [
      'pirkka luomu kikherneet',
      'organic chickpeas',
      'luomu kikherneet',
      'pirkka organic chickpeas',
    ],
  },
  {
    id: 'kruoka-bonduelle-kikherneet-310g',
    officialName: 'Bonduelle kikherneet 310g/265g',
    unit: 'PRK',
    packSize: '310g/265g',
    unitPriceAlv0: 2.0,
    ingredientType: 'canned',
    section: 'K-Ruoka · canned',
    aliases: [
      'bonduelle kikherneet',
      'bonduelle chickpeas',
      'chickpeas bonduelle',
    ],
  },

  // --- Oils ---
  {
    id: 'kruoka-neito-rypsioljy-500ml',
    officialName: 'Neito rypsiöljy 500 ml',
    unit: 'PL',
    packSize: '500 ml',
    unitPriceAlv0: 3.82,
    ingredientType: 'oils',
    section: 'K-Ruoka · oils',
    aliases: [
      'neito rypsiöljy',
      'neito rapeseed oil',
      'neito oil',
      'pressed rapeseed oil neito',
    ],
  },
  {
    id: 'kruoka-flora-rypsioljy-05l',
    officialName: 'Flora rypsiöljy 0,5 l',
    unit: 'PL',
    packSize: '0,5 l',
    unitPriceAlv0: 2.18,
    ingredientType: 'oils',
    section: 'K-Ruoka · oils',
    aliases: [
      'flora rypsiöljy',
      'flora rapeseed oil',
      'fairy rapeseed oil',
      'flora oil 0.5l',
    ],
  },
  {
    id: 'kruoka-pirkka-ekstra-neitsytoliivioljy-500ml',
    officialName: 'Pirkka ekstra-neitsytoliiviöljy 500 ml',
    unit: 'PL',
    packSize: '500 ml',
    unitPriceAlv0: 4.82,
    ingredientType: 'oils',
    section: 'K-Ruoka · oils',
    aliases: [
      'pirkka oliiviöljy',
      'pirkka extra virgin olive oil',
      'pirkka evoo',
      'ekstra-neitsytoliiviöljy',
    ],
  },
  {
    id: 'kruoka-bertolli-evoo-spray-200ml',
    officialName: 'Bertolli ekstra-neitsytoliiviöljyspray 200 ml',
    unit: 'PL',
    packSize: '200 ml',
    unitPriceAlv0: 6.42,
    ingredientType: 'oils',
    section: 'K-Ruoka · oils',
    aliases: [
      'bertolli spray',
      'olive oil spray',
      'bertolli evoo spray',
      'oliiviöljyspray',
      'extrneitsytöljyspray',
    ],
  },
  {
    id: 'kruoka-bertolli-evoo-250ml',
    officialName: 'Bertolli ekstra-neitsytoliiviöljy 250 ml',
    unit: 'PL',
    packSize: '250 ml',
    unitPriceAlv0: 4.52,
    ingredientType: 'oils',
    section: 'K-Ruoka · oils',
    aliases: [
      'bertolli oliiviöljy',
      'bertolli extra virgin',
      'bertolli evoo',
      'bertolli 250ml',
    ],
  },

  // --- Nuts ---
  {
    id: 'kruoka-pirkka-pekaanipahkina-125g',
    officialName: 'Pirkka pekaanipähkinä 125 g',
    unit: 'PSS',
    packSize: '125 g',
    unitPriceAlv0: 3.24,
    ingredientType: 'nuts_seeds',
    section: 'K-Ruoka · nuts',
    aliases: [
      'pirkka pekaanipähkinä',
      'pirkka pecans',
      'pecan nuts 125g',
      'pekaanipähkinä 125g',
    ],
  },
  {
    id: 'kruoka-foodin-pekaanipahkina-120g',
    officialName: 'Foodin pekaanipähkinä 120 g luomu',
    unit: 'PSS',
    packSize: '120 g',
    unitPriceAlv0: 5.92,
    ingredientType: 'nuts_seeds',
    section: 'K-Ruoka · nuts',
    aliases: [
      'foodin pekaanipähkinä',
      'foodin pecan',
      'organic pecans foodin',
      'luomu pekaanipähkinä',
    ],
  },
  {
    id: 'kruoka-grefinn-pekaanipahkina-300g',
    officialName: 'Grefinn Super Nuts pecanpähkinä 300 g',
    unit: 'PSS',
    packSize: '300 g',
    unitPriceAlv0: 10.79,
    ingredientType: 'nuts_seeds',
    section: 'K-Ruoka · nuts',
    aliases: [
      'grefinn pecan',
      'grefinn pekaanipähkinä',
      'super nuts pecan',
      'grefinn pecans 300g',
    ],
  },
];

/** Opening stock on default place (Downstairs kitchen). */
export const KRUOKA_SEED_QTY: Record<string, number> = {
  'kruoka-herkkumaa-taysmajoneesi-5kg': 2,
  'kruoka-herkkumaa-kevytmajoneesi-5kg': 1,
  'kruoka-felix-majoneesi': 3,
  'kruoka-maille-dijon': 2,
  'kruoka-herkkumaa-sinappimajoneesi': 1,
  // Produce
  'kruoka-pirkka-pesty-porkkana-1kg': 4,
  'kruoka-pirkka-luomu-pesty-porkkana-1kg': 2,
  'kruoka-muumi-porkkana-600g': 3,
  'kruoka-pirkka-sitruuna-luomu': 6,
  'kruoka-jarvikyla-korianteri-20g': 3,
  'kruoka-pirkka-jaasalatti-100g': 4,
  'kruoka-pirkka-rucola-luomu-65g': 3,
  'kruoka-lime-kpl': 8,
  'kruoka-lime-2-3kpl-220g': 3,
  'kruoka-bataatti': 5,
  'kruoka-bataatti-luomu': 3,
  // Dairy
  'kruoka-pirkka-parhaat-fetajuusto-150g': 4,
  'kruoka-atria-rahkaohukainen-kaakao-vadelma-380g': 1,
  // Spices & salt
  'kruoka-pirkka-juustokumina-25g': 2,
  'kruoka-pirkka-luomu-juustokumina-27g': 1,
  'kruoka-meira-juustokumina-25g': 2,
  'kruoka-pirkka-mustapippuri-21g': 3,
  'kruoka-santa-maria-mustapippuri-22g': 2,
  'kruoka-meira-mustapippuri-27g': 2,
  'kruoka-pirkka-paprikajauhe-25g': 2,
  'kruoka-meira-paprikajauhe-24g': 2,
  'kruoka-meira-paprikajauhe-savustettu-22g': 1,
  'kruoka-jozo-poytasuola-125g': 2,
  'kruoka-jozo-suola-600g': 2,
  'kruoka-pirkka-suola-1kg': 3,
  // Canned
  'kruoka-pirkka-kikherneet-380g': 6,
  'kruoka-pirkka-luomu-kikherneet-380g': 4,
  'kruoka-bonduelle-kikherneet-310g': 3,
  // Oils
  'kruoka-neito-rypsioljy-500ml': 2,
  'kruoka-flora-rypsioljy-05l': 2,
  'kruoka-pirkka-ekstra-neitsytoliivioljy-500ml': 2,
  'kruoka-bertolli-evoo-spray-200ml': 1,
  'kruoka-bertolli-evoo-250ml': 2,
  // Nuts
  'kruoka-pirkka-pekaanipahkina-125g': 2,
  'kruoka-foodin-pekaanipahkina-120g': 1,
  'kruoka-grefinn-pekaanipahkina-300g': 1,
};
