/**
 * Map label / OCR packaging cues → POS unit + human container hint.
 * Retail liquid cartons are usually counted as KPL with packSize holding volume.
 */
import type { UnitCode } from '../data/types';
import { UNIT_LABELS } from '../data/units';

const CONTAINER_BY_UNIT: Partial<Record<UnitCode, string>> = {
  PRK: 'Purkki (can / jar)',
  RSA: 'Rasia (box / container)',
  RAS: 'Rasia (box / container)',
  PSS: 'Pussi (bag / pouch)',
  PL: 'Pullo (bottle)',
  PLO: 'Pullo (bottle)',
  LTK: 'Laatikko (crate / box)',
  PKT: 'Paketti (packet / package)',
  L: 'Litra (liquid volume)',
  KG: 'Kilogramma (weight)',
  KPL: 'Kappale (piece / item)',
};

export function containerLabelForUnit(unit: UnitCode): string | undefined {
  return CONTAINER_BY_UNIT[unit] ?? UNIT_LABELS[unit];
}

export type PackagingInference = {
  unit?: UnitCode;
  containerHint: string;
};

/**
 * Normalize free-text packaging (Tetra Pak, pullo, purkki…) into POS-friendly
 * containerHint + optional unit override.
 */
export function inferPackaging(
  rawHint?: string | null,
  packSize?: string | null,
  currentUnit?: UnitCode | null,
): PackagingInference | null {
  const text = `${rawHint ?? ''} ${packSize ?? ''}`.toLowerCase();
  if (!text.trim()) {
    if (currentUnit) {
      return {
        unit: currentUnit,
        containerHint: containerLabelForUnit(currentUnit) ?? currentUnit,
      };
    }
    return null;
  }

  if (/tetra|kartonk|tölkki|tolkki|carton|c\/pap|nestepakkaus/.test(text)) {
    // Ready-to-drink carton sold per piece; volume stays in packSize
    return {
      unit: 'KPL',
      containerHint: 'Tetra Pak / kartonki (carton)',
    };
  }
  if (/pullo|bottle|pet\b/.test(text)) {
    return { unit: /plo\b/.test(text) ? 'PLO' : 'PL', containerHint: 'Pullo (bottle)' };
  }
  if (/purkki|can\b|jar\b|tin\b/.test(text)) {
    return { unit: 'PRK', containerHint: 'Purkki (can / jar)' };
  }
  if (/pussi|bag\b|pouch|säkki|sakki/.test(text)) {
    return { unit: 'PSS', containerHint: 'Pussi (bag / pouch)' };
  }
  if (/rasia|tray|tub\b/.test(text)) {
    return { unit: 'RSA', containerHint: 'Rasia (box / container)' };
  }
  if (/laatikko|crate|case\b/.test(text)) {
    return { unit: 'LTK', containerHint: 'Laatikko (crate / box)' };
  }
  if (/paketti|packet|pack\b/.test(text)) {
    return { unit: 'PKT', containerHint: 'Paketti (packet / package)' };
  }

  if (rawHint?.trim()) {
    return {
      unit: currentUnit ?? undefined,
      containerHint: rawHint.trim(),
    };
  }
  if (currentUnit) {
    return {
      unit: currentUnit,
      containerHint: containerLabelForUnit(currentUnit) ?? currentUnit,
    };
  }
  return null;
}

/** Digits-only EAN/GTIN if length looks valid. */
export function normalizeEanDigits(raw?: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  if (d.length >= 8 && d.length <= 14) return d;
  return null;
}

/**
 * True when a “name” is only a retail barcode (EAN/UPC digits), not a
 * human product title. Used so Confirm/search never treat the code as identity.
 */
export function isBareEanLabel(raw?: string | null): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Allow spaces/dashes between digits; reject any letters.
  if (/[A-Za-zÅÄÖåäö]/.test(trimmed)) return false;
  const digits = normalizeEanDigits(trimmed);
  if (!digits) return false;
  return digits === trimmed.replace(/\D/g, '');
}

/** Pull first EAN-13-ish run from OCR / filename / hint text. */
export function extractEanFromText(text: string): string | null {
  const spaced = text.replace(/(\d)\s+(?=\d)/g, '$1');
  const m = /\b(\d{8,14})\b/.exec(spaced);
  return m ? normalizeEanDigits(m[1]) : null;
}
