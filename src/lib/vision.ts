/**
 * Product / document vision entry point.
 * Live Gemini when EXPO_PUBLIC_GEMINI_API_KEY is set; otherwise DEV stub.
 */
import type { DocumentExtract, VisionExtract } from '../data/types';
import {
  analyzeImagesWithGemini,
  isRealImageUri,
} from './geminiVision';
import { isLiveVisionEnabled } from './visionConfig';
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
  if (isLiveVisionEnabled() && isRealImageUri(imageUri)) {
    return analyzeImagesWithGemini([imageUri], hint);
  }
  return stubInventory(imageUri, hint);
}

export async function analyzeProductCloseups(
  imageUris: string[],
  hint?: string,
): Promise<VisionExtract> {
  const real = imageUris.filter(isRealImageUri);
  if (isLiveVisionEnabled() && real.length) {
    return analyzeImagesWithGemini(real, hint);
  }
  return stubCloseups(imageUris, hint);
}

export async function analyzeFridgePanoramaImage(
  imageUri: string,
): Promise<DocumentExtract> {
  // Multi-item fridge still uses document stub until paid document vision
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
