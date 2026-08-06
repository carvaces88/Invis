/**
 * Product / document vision entry point.
 * Real photos → Gemini (client key or /api/vision proxy).
 * Offline demo URIs → stub (Figaro/capers only when no real photo).
 */
import type { DocumentExtract, VisionExtract } from '../data/types';
import {
  analyzeFridgeShelfWithGemini,
  analyzeImagesWithGemini,
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

export { isLiveVisionEnabled } from './visionConfig';
export { isPaidDocumentVisionEnabled, isVideoAnalysisEnabled, isRealImageUri };

export async function analyzeInventoryImage(
  imageUri: string,
  hint?: string,
): Promise<VisionExtract> {
  if (isRealImageUri(imageUri)) {
    try {
      return await analyzeImagesWithGemini([imageUri], hint);
    } catch {
      // No key / proxy down — never invent Figaro/capers for a real photo
      return stubInventory(imageUri, hint);
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
    } catch {
      return stubCloseups(real, hint);
    }
  }
  return stubCloseups(imageUris, hint);
}

export async function analyzeFridgePanoramaImage(
  imageUri: string,
): Promise<DocumentExtract> {
  if (isRealImageUri(imageUri)) {
    try {
      return await analyzeFridgeShelfWithGemini(imageUri);
    } catch {
      // No key / proxy down — fall back to stub demos
      return stubFridge(imageUri);
    }
  }
  // demo-fresh, cilantro, mayo demos, etc.
  return stubFridge(imageUri);
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
