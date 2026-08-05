import {
  DEMO_MAYO_CROP,
  DEMO_MAYO_CROP_SHELF2,
} from './seedKruoka';
import type { DocumentExtract } from './types';

/** Demo delivery-list payloads — offline, no API keys */
export const DEMO_KUORMA_A: DocumentExtract = {
  kind: 'kuorma',
  title: 'Delivery list · demo A',
  confidence: 0.84,
  rawNotes:
    'Stub delivery: informal names (capers, olive oil) — alias matcher should resolve catalog rows.',
  lines: [
    {
      suggestedName: 'capers',
      unit: 'PRK',
      quantity: 4,
      unitPriceAlv0: 4.2,
      confidence: 0.82,
    },
    {
      suggestedName: 'olive oil',
      unit: 'L',
      quantity: 5,
      unitPriceAlv0: 9.5,
      confidence: 0.88,
    },
    {
      suggestedName: 'basmati',
      unit: 'KG',
      quantity: 10,
      confidence: 0.8,
    },
    {
      suggestedName: 'chickpeas',
      unit: 'PRK',
      quantity: 12,
      confidence: 0.79,
    },
  ],
};

export const DEMO_KUORMA_B: DocumentExtract = {
  kind: 'kuorma',
  title: 'Delivery list · demo B (Metro)',
  confidence: 0.81,
  rawNotes: 'Second demo delivery sheet with produce + dry goods.',
  lines: [
    {
      suggestedName: 'ananas',
      unit: 'KG',
      quantity: 8,
      confidence: 0.9,
    },
    {
      suggestedName: 'rapsiöljy',
      unit: 'L',
      quantity: 3,
      confidence: 0.85,
    },
    {
      suggestedName: 'polenta',
      unit: 'KPL',
      quantity: 2,
      confidence: 0.77,
    },
    {
      suggestedName: 'nachos',
      unit: 'PSS',
      quantity: 6,
      confidence: 0.75,
    },
  ],
};

export const DEMO_HAVIKKI_A: DocumentExtract = {
  kind: 'havikki',
  title: 'Food waste · prep station',
  station: 'Prep',
  confidence: 0.8,
  rawNotes:
    'Stub waste list: cooked rice + puree — will subtract stock after confirm.',
  lines: [
    {
      suggestedName: 'basmati rice',
      unit: 'KG',
      quantity: 0.5,
      confidence: 0.83,
      rawNotes: '0.5 kg cooked rice',
    },
    {
      suggestedName: 'vadelma',
      unit: 'RAS',
      quantity: 1,
      confidence: 0.78,
    },
    {
      suggestedName: 'falafel',
      unit: 'KPL',
      quantity: 4,
      confidence: 0.8,
    },
  ],
};

export const DEMO_HAVIKKI_B: DocumentExtract = {
  kind: 'havikki',
  title: 'Food waste · hot line',
  station: 'Hot line',
  confidence: 0.76,
  rawNotes: 'End-of-day waste from hot line.',
  lines: [
    {
      suggestedName: 'sushiriisi',
      unit: 'KG',
      quantity: 0.3,
      confidence: 0.81,
    },
    {
      suggestedName: 'oliiviöljy',
      unit: 'L',
      quantity: 0.1,
      confidence: 0.7,
    },
  ],
};

/**
 * Walk-in shelf photo demo — Herkkumaa mayo bucket + a few neighbors.
 * Crop rects zoom the confirm card onto each product (not the whole shelf).
 * Pair with resolveDemoShelfUri('mayo1') as imageUri.
 */
export const DEMO_FRIDGE_PANORAMA: DocumentExtract = {
  kind: 'fridge',
  title: 'Walk-in shelf · mayo demo',
  confidence: 0.84,
  rawNotes:
    'Stub vision: label text → catalog fuzzy match. Confirm with K-Ruoka packshot.',
  lines: [
    {
      suggestedName: 'Herkkumaa täysmajoneesi',
      unit: 'PRK',
      quantity: 1,
      confidence: 0.91,
      rawNotes: 'White 5 kg bucket, black label, second shelf',
      crop: { ...DEMO_MAYO_CROP },
    },
    {
      suggestedName: 'Herkkumaa kevytmajoneesi',
      unit: 'PRK',
      quantity: 1,
      confidence: 0.78,
      rawNotes: 'Neighbor white bucket on same shelf',
      crop: {
        x: 0.52,
        y: 0.42,
        width: 0.28,
        height: 0.16,
        previewColor: '#F0F4F8',
      },
    },
    {
      suggestedName: 'Felix majoneesi',
      unit: 'PRK',
      quantity: 3,
      confidence: 0.72,
      rawNotes: 'Glass jars with red lids, top shelf',
      crop: {
        x: 0.05,
        y: 0.12,
        width: 0.28,
        height: 0.16,
        previewColor: '#C45C4A',
      },
    },
    {
      suggestedName: 'Unknown container',
      unit: 'RAS',
      quantity: 1,
      confidence: 0.24,
      unrecognized: true,
      aiDescription:
        'Large cheese block in clear plastic on the second shelf — brand not readable.',
      rawNotes: 'Low confidence — needs your description',
      crop: {
        x: 0.72,
        y: 0.4,
        width: 0.22,
        height: 0.18,
        previewColor: '#F5E6C8',
      },
    },
  ],
};

/** Alternate shelf photo (mayo2) — same Herkkumaa match, different crop. */
export const DEMO_SHELF_MAYO_ALT: DocumentExtract = {
  kind: 'fridge',
  title: 'Walk-in shelf · mayo demo B',
  confidence: 0.86,
  rawNotes: 'Alternate angle of Herkkumaa täysmajoneesi 5 kg bucket.',
  lines: [
    {
      suggestedName: 'Herkkumaa täysmajoneesi',
      unit: 'PRK',
      quantity: 1,
      confidence: 0.93,
      crop: { ...DEMO_MAYO_CROP_SHELF2 },
    },
  ],
};

/**
 * Fresh herbs / dairy fridge stub — cilantro bunch + yogurt + neighbors.
 * Pair with imageUri 'demo-fresh' (no bundled photo required).
 */
export const DEMO_FRIDGE_FRESH: DocumentExtract = {
  kind: 'fridge',
  title: 'Fridge · fresh herbs & dairy',
  confidence: 0.81,
  rawNotes:
    'Stub vision: loose/fresh labels → catalog fuzzy match (cilantro, yogurt).',
  lines: [
    {
      suggestedName: 'cilantro',
      unit: 'KPL',
      quantity: 2,
      confidence: 0.88,
      rawNotes: 'Green herb bunch on the fridge door shelf',
      crop: {
        x: 0.12,
        y: 0.28,
        width: 0.32,
        height: 0.22,
        previewColor: '#3D8B5F',
      },
    },
    {
      suggestedName: 'yogurt',
      unit: 'KG',
      quantity: 1,
      confidence: 0.84,
      rawNotes: 'White dairy tub, middle shelf',
      crop: {
        x: 0.48,
        y: 0.4,
        width: 0.28,
        height: 0.2,
        previewColor: '#F5F2EA',
      },
    },
    {
      suggestedName: 'parsley',
      unit: 'KPL',
      quantity: 1,
      confidence: 0.76,
      rawNotes: 'Herb bunch next to cilantro',
      crop: {
        x: 0.1,
        y: 0.52,
        width: 0.28,
        height: 0.18,
        previewColor: '#4FA36A',
      },
    },
    {
      suggestedName: 'Unknown item',
      unit: 'RAS',
      quantity: 1,
      confidence: 0.22,
      unrecognized: true,
      aiDescription:
        'Small clear tub on the bottom shelf — label not readable.',
      rawNotes: 'Low confidence — needs your description',
      crop: {
        x: 0.62,
        y: 0.62,
        width: 0.24,
        height: 0.16,
        previewColor: '#D8D4CC',
      },
    },
  ],
};
