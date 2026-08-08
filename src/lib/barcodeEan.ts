/**
 * On-device barcode → VisionExtract (no Gemini).
 * Product barcodes only: EAN-13 / EAN-8 / UPC-A / UPC-E.
 */
import type { VisionExtract } from '../data/types';
import { normalizeEanDigits } from './packaging';

const PRODUCT_LEN = new Set([8, 12, 13]);

/** True when digits look like a retail product EAN/UPC (not QR payload). */
export function isProductBarcodeData(raw: string | null | undefined): boolean {
  const d = normalizeEanDigits(raw);
  return Boolean(d && PRODUCT_LEN.has(d.length));
}

/** Build a high-confidence extract from a decoded EAN — lookup happens downstream. */
export function visionExtractFromEan(
  raw: string,
  opts?: { quantity?: number | null; expiryDate?: string | null },
): VisionExtract | null {
  const ean = normalizeEanDigits(raw);
  if (!ean || !PRODUCT_LEN.has(ean.length)) return null;
  return {
    suggestedName: ean,
    unit: 'KPL',
    quantity: opts?.quantity ?? 1,
    unitPriceAlv0: null,
    expiryDate: opts?.expiryDate ?? null,
    confidence: 1,
    ean,
    rawNotes: 'Scanned barcode (on-device decode — no AI)',
    unrecognized: false,
  };
}

export const PRODUCT_BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
] as const;
