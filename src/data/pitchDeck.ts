/**
 * Investor pitch deck copy + chart numbers.
 * Business narrative only — no stack, hosts, or implementation details.
 */

export const pitchMeta = {
  brand: 'Invis, by Countro',
  /** Compact mark for hub / compare columns */
  brandShort: 'INVIS',
  tagline: 'Kitchen inventory made simple',
  presentationLabel: 'Investor Pitch Deck',
  audience:
    'Full-service restaurant kitchens, head chefs, kitchen managers, and multi-concept restaurant groups.',
};

export const pitchVision = {
  headline: 'Our solution',
  body: 'INVIS turns fridge and pack photos into counted stock. Vision + K-Ruoka recognize products, chefs confirm quantities in kitchen units (YKSIKKÖ) with prices at 0% ALV. Main Invis is the full sheet; Mini / Simple Invis + fire mode keep counts alive mid-service — then Restolution-ready export closes the period.',
  vsLegacyTitle: 'vs legacy software',
  vsLegacy:
    'Legacy kitchen systems (MarketMan, Restaurant365) are desktop-heavy, clunky, and require months of onboarding. INVIS is built for prep-room speed: mobile counting, delivery & waste lists, POS-ready exports, and Nordic distributor price checks.',
  legacyBullets: [
    'Desktop-heavy UIs',
    'Months of onboarding',
    'Enterprise ERP bloat',
  ],
  invisBullets: [
    'Main Invis · photo + voice stock',
    'Mini Invis · fire mode mid-service',
    'Multi-venue · multi-fridge places',
  ],
};

/** Product + how-it-works (core kitchen flow) */
export const pitchProduct = {
  headline: 'The product',
  body: 'Two modes, one kitchen truth: Main Invis for full inventaario (photo, voice, export), and Mini / Simple Invis for mid-service speed — including fire mode. Stock stays at 0% ALV across venues and fridges.',
  flowLabel: 'How it works',
  steps: [
    {
      short: 'Photo',
      title: 'Scan fridge or pack',
      body: 'Snap a fridge shelf, freezer, or product label. One photo can cover many items mid-prep.',
    },
    {
      short: 'Voice',
      title: 'Dictate the walk-in',
      body: 'Hands-free walk-through: speak items while you move; transcript becomes reviewable stock lines.',
    },
    {
      short: 'Places',
      title: 'Venues & fridges',
      body: 'A company can run several restaurants; each site has walk-ins, freezers, dry stores. Counts always belong to one place.',
    },
    {
      short: 'Mini',
      title: 'Mini Invis + fire mode',
      body: 'Simple Invis for mid-service: swipe ±1 by category, or open fire mode for one-item focused counting.',
    },
    {
      short: 'Export',
      title: 'Restolution sheet',
      body: 'Export the period close kitchen managers already need — no retyping clipboard inventaario into POS.',
    },
  ],
};

export const pitchMoat = [
  {
    title: 'First-hand chef expertise',
    body: 'Designed by a former professional chef with 10+ years in real kitchens. The product fits how stock is actually counted — units, packs, deliveries, and hävikki — workflows corporate tools miss.',
  },
  {
    title: 'Kitchen-speed product',
    body: 'Ships as a fast mobile experience chefs actually open mid-service — not a desk-bound ERP. New kitchen workflows land without enterprise rollout theater.',
  },
  {
    title: 'Supplier & wholesale path',
    body: 'Roadmap to regional food wholesalers and Nordic e-invoicing so ingredient costs stay current as market prices move — kitchens stop retyping price lists.',
  },
];

/** Bottom-up market sizing (editable) */
export const pitchMarket = {
  globalTamUsdB: 4.2,
  cagrPct: 13.5,
  euOutletsM: 1.8,
  euFullServiceKitchensK: 600,
  euSamArrEurM: 712,
  fiQualifiedRestaurants: 3500,
  fiTargetAccounts: 400,
  arpuEurMonth: 79,
  /** FI + SE + NO + DK kitchen target after Finland SOM */
  nordicsTargetAccounts: 1200,
};

export function finlandSomArrEur(m = pitchMarket): number {
  return m.fiTargetAccounts * m.arpuEurMonth * 12;
}

export function nordicsArrEur(m = pitchMarket): number {
  return m.nordicsTargetAccounts * m.arpuEurMonth * 12;
}

export function projectionArrEur(kitchens: number, m = pitchMarket): number {
  return kitchens * m.arpuEurMonth * 12;
}

/**
 * Approximate share of Finnish full-service restaurant density by region
 * (pitch visualization — edit as research tightens).
 * Positions are % within the Finland map frame (viewBox 0 0 1000 1000).
 */
export const finlandRestaurantRegions = [
  {
    id: 'uusimaa',
    name: 'Uusimaa',
    city: 'Helsinki metro',
    pct: 38.5,
    topPct: 84,
    leftPct: 56,
    size: 'lg' as const,
  },
  {
    id: 'pirkanmaa',
    name: 'Pirkanmaa',
    city: 'Tampere',
    pct: 9.2,
    topPct: 72,
    leftPct: 48,
    size: 'md' as const,
  },
  {
    id: 'varsinais',
    name: 'Varsinais-Suomi',
    city: 'Turku',
    pct: 8.1,
    topPct: 82,
    leftPct: 34,
    size: 'md' as const,
  },
  {
    id: 'pohjois-pohjanmaa',
    name: 'Pohjois-Pohjanmaa',
    city: 'Oulu',
    pct: 5.4,
    topPct: 42,
    leftPct: 48,
    size: 'sm' as const,
  },
  {
    id: 'keski-suomi',
    name: 'Keski-Suomi',
    city: 'Jyväskylä',
    pct: 4.6,
    topPct: 62,
    leftPct: 54,
    size: 'sm' as const,
  },
  {
    id: 'other',
    name: 'Rest of Finland',
    city: 'Regional',
    pct: 34.2,
    topPct: 18,
    leftPct: 55,
    size: 'sm' as const,
  },
] as const;

export type PitchHorizonId = 'now' | '6m' | '1y' | '5y' | 'nordics';
export type PitchRegionScope = 'finland' | 'nordics';

/** Account / ARR projections by horizon (editable) */
export const pitchProjections: {
  id: PitchHorizonId;
  label: string;
  /** Short label for compact chips */
  shortLabel: string;
  kitchens: number;
  /** Ring fill vs Nordics target (visual growth through Scandinavia) */
  ofNordicsPct: number;
  /** Ring fill vs Finland SOM (400) — useful for FI-only framing */
  ofSomPct: number;
  mrrEur: number;
  scope: PitchRegionScope;
  note: string;
}[] = [
  {
    id: 'now',
    label: 'Now',
    shortLabel: 'Now',
    kitchens: 3,
    ofNordicsPct: 1,
    ofSomPct: 1,
    mrrEur: 3 * pitchMarket.arpuEurMonth,
    scope: 'finland',
    note: '3 pilot kitchens in Finland (anonymous design partners)',
  },
  {
    id: '6m',
    label: '6 months',
    shortLabel: '6 mo',
    kitchens: 40,
    ofNordicsPct: 3,
    ofSomPct: 10,
    mrrEur: 40 * pitchMarket.arpuEurMonth,
    scope: 'finland',
    note: 'Helsinki metro + Tampere beachhead',
  },
  {
    id: '1y',
    label: '1 year',
    shortLabel: '1 yr',
    kitchens: 120,
    ofNordicsPct: 10,
    ofSomPct: 30,
    mrrEur: 120 * pitchMarket.arpuEurMonth,
    scope: 'finland',
    note: 'Multi-city Finland · first Pro seats',
  },
  {
    id: '5y',
    label: '5 years',
    shortLabel: '5 yr FI',
    kitchens: 400,
    ofNordicsPct: 33,
    ofSomPct: 100,
    mrrEur: 400 * pitchMarket.arpuEurMonth,
    scope: 'finland',
    note: 'Finland SOM locked — ready for Scandinavia',
  },
  {
    id: 'nordics',
    label: 'Nordics',
    shortLabel: 'Nordics',
    kitchens: pitchMarket.nordicsTargetAccounts,
    ofNordicsPct: 100,
    ofSomPct: 100,
    mrrEur: pitchMarket.nordicsTargetAccounts * pitchMarket.arpuEurMonth,
    scope: 'nordics',
    note: 'Expand to Sweden, Norway & Denmark after Finland proof',
  },
];

/** Approach / go-to-market hub nodes */
export const pitchApproach = [
  { label: 'Pilot kitchens', short: 'Pilot' },
  { label: 'Prove waste ROI', short: 'ROI' },
  { label: 'Chef-led onboarding', short: 'Onboard' },
  { label: 'Nordic expand', short: 'Nordics' },
  { label: 'POS depth', short: 'POS' },
  { label: 'Wholesale links', short: 'Supply' },
];

/** Business model pillars */
export const pitchBusinessModel = [
  {
    title: 'Service',
    body: 'Kitchen-first inventory, delivery & waste flows chefs finish in minutes.',
  },
  {
    title: 'Product',
    body: 'Photo counting, catalog match, and Restolution exports kitchens already need for close.',
  },
  {
    title: 'Cost',
    body: '€79/mo target ARPU — a fraction of legacy MarketMan / R365 seats.',
  },
  {
    title: 'Revenue',
    body: 'SaaS per kitchen + Pro walkthrough. Land Finland, expand Nordics.',
  },
];

export const pitchCompetitors = [
  {
    name: 'MarketMan',
    priceLow: 199,
    priceHigh: 249,
    note: 'Steep learning curve; slow mobile for prep audits',
  },
  {
    name: 'MarginEdge',
    priceLow: 330,
    priceHigh: 330,
    note: 'US back-office focus; bloated for agile EU kitchens',
  },
  {
    name: 'Restaurant365',
    priceLow: 299,
    priceHigh: 499,
    note: 'Heavy ERP; needs dedicated accounting staff',
  },
  {
    name: 'Sortly',
    priceLow: 24,
    priceHigh: 89,
    note: 'Generic asset tracker — no hospitality inventory logic',
  },
  {
    name: 'INVIS',
    priceLow: 79,
    priceHigh: 79,
    note: 'Kitchen-speed · Nordic-first · priced for independent kitchens',
    highlight: true,
  },
] as const;

export const pitchRoi = {
  wasteOfPurchasesLowPct: 4,
  wasteOfPurchasesHighPct: 10,
  wasteCutPct: 25,
  /** Hours of inventaario / stock admin saved per week (chef-facing) */
  hoursSavedWeekly: 10,
  points: [
    {
      title: 'Food waste reduction',
      body: 'Food waste is 4–10% of raw food purchases. INVIS tracks hävikki and stock movements — cutting kitchen waste by up to 25%.',
    },
    {
      title: 'Accurate stock value',
      body: 'Counts and prices stay at 0% ALV with clear ALV display — managers see real inventory € without spreadsheet rework.',
    },
    {
      title: 'Faster month close',
      body: 'Photo inventaario → confirm → Restolution export replaces clipboard sheets and hours of admin each period.',
    },
  ],
};

export const pitchAsk = {
  headline: 'The ask',
  amountEur: 60_000,
  amountLabel: '€60k',
  body: '€60k to land Finland beachhead: ship Main + Mini Invis harder, fill 40 kitchen seats, and keep ops tight — then prove waste & labor ROI before Nordics.',
  useOfFunds: [
    {
      label: 'Product development',
      pct: 42,
      eur: 25_000,
      body: 'Main Invis depth, Mini / fire mode, voice, Restolution & POS sync.',
    },
    {
      label: 'Marketing & acquisition',
      pct: 33,
      eur: 20_000,
      body: 'Chef-led pilots, Helsinki/Tampere beachhead, content & kitchen demos.',
    },
    {
      label: 'Operations',
      pct: 25,
      eur: 15_000,
      body: 'Onboarding, support for pilot kitchens, and day-to-day run costs.',
    },
  ],
  bullets: [
    '3 anonymous pilot kitchens → path to 40 FI seats',
    'Main Invis + Mini Invis / fire mode product velocity',
    'Nordics after Finland SOM · Scandinavia ARR path',
  ],
  founderQuote:
    'Countro is Cesar (food & marketing) and Ivan (beverages & development) — inventaario built from the walk-in, not from a desk ERP.',
  founderRole: 'Countro · Cesar Carvajal & Ivan',
};
