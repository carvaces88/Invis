/**
 * Product / document vision entry point.
 * Real photos → Gemini (client key or /api/vision proxy).
 * Offline demo URIs → stub (Figaro/capers only when no real photo).
 */
import type { DocumentExtract, VisionExtract } from '../data/types';
import {
  analyzeFridgeShelfWithGemini,
  analyzeImagesWithGemini,
  analyzeInventaarioSheetWithGemini,
  isRealImageUri,
} from './geminiVision';
import {
  analyzeFridgePanoramaImage as stubFridge,
  analyzeHavikkiImage as stubHavikki,
  analyzeInventoryImage as stubInventory,
  analyzeKuormaImage as stubKuorma,
  analyzeProductCloseups as stubCloseups,
  isPaidDocumentVisionEnabled,
  isVideoAnalysisEnabled,
} from './visionStub';
import { isLiveVisionEnabled } from './visionConfig';

export { isLiveVisionEnabled } from './visionConfig';
export { isPaidDocumentVisionEnabled, isVideoAnalysisEnabled, isRealImageUri };

function unrecognizedFromError(
  hint: string | undefined,
  err: unknown,
): VisionExtract {
  const msg = err instanceof Error ? err.message : 'Vision failed';
  const configured = isLiveVisionEnabled();
  const keyRestricted =
    /are blocked|has not been used|is disabled|API key not valid|PERMISSION_DENIED|Generative Language/i.test(
      msg,
    );
  const notes = /not configured|GEMINI_API_KEY|Vision API not configured/i.test(
    msg,
  )
    ? 'Photo received, but live label reading is not configured. Set GEMINI_API_KEY on the server (/api/vision) for production web, or EXPO_PUBLIC_GEMINI_API_KEY for local Expo.'
    : keyRestricted
      ? 'Live label reading blocked by the Google API key. In Cloud Console → Credentials, set Application restrictions to None (needed for Vercel) and allow Generative Language API. Wait 1–5 min, then retry. Match inventory or add as new — we will not invent a K-Ruoka match.'
      : configured
        ? `Live label reading failed: ${msg}. Match an inventory product or add this as new — we will not invent a K-Ruoka match.`
        : 'Photo received, but live label reading is not configured. Match an inventory product or add this as new.';
  return {
    suggestedName: hint?.trim() || 'Unknown product',
    unit: 'KPL',
    quantity: 1,
    unitPriceAlv0: null,
    expiryDate: null,
    confidence: hint?.trim() ? 0.35 : 0.12,
    packSize: null,
    brand: null,
    containerHint: null,
    ean: null,
    aliases: hint?.trim() ? [hint.trim().toLowerCase()] : [],
    unrecognized: true,
    rawNotes: notes,
  };
}

export async function analyzeInventoryImage(
  imageUri: string,
  hint?: string,
): Promise<VisionExtract> {
  if (isRealImageUri(imageUri)) {
    try {
      return await analyzeImagesWithGemini([imageUri], hint);
    } catch (err) {
      // Never invent Figaro/capers — and never a fake public listing either
      return unrecognizedFromError(hint, err);
    }
  }
  return stubInventory(imageUri, hint);
}

export async function analyzeProductCloseups(
  imageUris: string[],
  hint?: string,
): Promise<VisionExtract> {
  const real = imageUris.filter(isRealImageUri);
  if (real.length) {
    try {
      return await analyzeImagesWithGemini(real, hint);
    } catch (err) {
      return unrecognizedFromError(hint, err);
    }
  }
  return stubCloseups(imageUris, hint);
}

export async function analyzeFridgePanoramaImage(
  imageUri: string,
  hint?: string,
): Promise<DocumentExtract> {
  const trimmed = hint?.trim() || undefined;
  if (isRealImageUri(imageUri)) {
    try {
      return await analyzeFridgeShelfWithGemini(imageUri, trimmed);
    } catch {
      // No key / proxy down — fall back to stub demos for fridge walkthroughs
      return stubFridge(imageUri, trimmed);
    }
  }
  // demo-fresh, cilantro, mayo demos, etc.
  return stubFridge(imageUri, trimmed);
}

export async function analyzeKuormaImage(
  imageUri: string,
  demoVariant: 'A' | 'B' = 'A',
): Promise<DocumentExtract> {
  return stubKuorma(imageUri, demoVariant);
}

export async function analyzeHavikkiImage(
  imageUri: string,
  demoVariant: 'A' | 'B' = 'A',
): Promise<DocumentExtract> {
  return stubHavikki(imageUri, demoVariant);
}

/**
 * Printed inventaariopohja / clipboard sheet photo → rows for SheetImportReview.
 * Real photos require Gemini (proxy or client key). No offline Figaro stub.
 */
export async function analyzeInventaarioSheetImage(
  imageUri: string,
  hint?: string,
): Promise<DocumentExtract> {
  const trimmed = hint?.trim() || undefined;
  if (!isRealImageUri(imageUri)) {
    throw new Error('Upload a photo of the printed inventory sheet first.');
  }
  try {
    return await analyzeInventaarioSheetWithGemini(imageUri, trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sheet OCR failed';
    throw new Error(msg);
  }
}
