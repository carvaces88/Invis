/**
 * Offline S-Kaupat shelf-price seed for Price comparison.
 * Prices are retail incl. food ALV 14% (shelf €). Convert with shelfToAlv0 when comparing.
 * Not affiliated with S Group — demo / fallback only.
 */
export type SkaupatSeedHit = {
  ean?: string;
  officialName: string;
  brand?: string;
  packSize?: string;
  /** Shelf / retail € including food ALV */
  shelfPriceEur: number;
  aliases: string[];
};

export const SEED_SKAUPAT_PRODUCTS: SkaupatSeedHit[] = [
  {
    ean: '6407800019265',
    officialName: 'Atria Kaakao-vadelma rahkaohukainen 380 g',
    brand: 'Atria',
    packSize: '380 g',
    shelfPriceEur: 2.79,
    aliases: ['atria rahkaohukainen', 'kaakao-vadelma', 'rahkaohukainen'],
  },
  {
    ean: '6411300001234',
    officialName: 'Felix Kapris 720 g',
    brand: 'Felix',
    packSize: '720 g',
    shelfPriceEur: 4.49,
    aliases: ['kapris', 'capers', 'felix kapris'],
  },
  {
    ean: '6410405090870',
    officialName: 'Pirkka majoneesi 1 kg',
    brand: 'Pirkka',
    packSize: '1 kg',
    shelfPriceEur: 3.29,
    aliases: ['pirkka majoneesi', 'mayo', 'majoneesi'],
  },
  {
    officialName: 'Valio kuohukerma 2 dl',
    brand: 'Valio',
    packSize: '2 dl',
    shelfPriceEur: 1.15,
    aliases: ['kuohukerma', 'cream', 'valio cream'],
  },
  {
    officialName: 'Rainbow tomaattimurska 400 g',
    brand: 'Rainbow',
    packSize: '400 g',
    shelfPriceEur: 0.89,
    aliases: ['tomaattimurska', 'tomato crushed', 'rainbow tomaatti'],
  },
];
