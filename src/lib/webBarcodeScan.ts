/**
 * Web barcode fallback when `BarcodeDetector` / expo-camera scanning is unavailable
 * (Safari, Firefox). Uses @zxing/library against a live getUserMedia stream.
 */
import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
  type Result,
} from '@zxing/library';

export function webHasNativeBarcodeDetector(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector ===
      'function'
  );
}

export type WebBarcodeStop = () => void;

/**
 * Continuous decode from the default rear camera into `videoEl`.
 * Returns a stop function (stops tracks + resets reader).
 */
export function startWebZxingScan(
  videoEl: HTMLVideoElement,
  onCode: (data: string) => void,
): WebBarcodeStop {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new BrowserMultiFormatReader(hints, 400);
  reader.timeBetweenDecodingAttempts = 250;

  let stopped = false;
  let last = '';

  const handle = (result: Result | undefined, _err: unknown) => {
    if (stopped || !result) return;
    const text = result.getText()?.trim();
    if (!text || text === last) return;
    last = text;
    onCode(text);
  };

  void reader.decodeFromVideoDevice(null, videoEl, handle).catch(() => {
    // Permission / device errors surface via empty preview; UI shows retry.
  });

  return () => {
    stopped = true;
    try {
      reader.reset();
    } catch {
      // ignore
    }
    const stream = videoEl.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    videoEl.srcObject = null;
  };
}
