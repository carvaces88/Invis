/**
 * Normalize ImagePicker assets so vision + inventory album work on web.
 * Web picker returns blob: URLs that can fail after revoke / do not persist.
 */
import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === 'function') return btoa(binary);
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const triplet =
      b === undefined
        ? a << 16
        : c === undefined
          ? (a << 16) | (b << 8)
          : (a << 16) | (b << 8) | c;
    out += alphabet[(triplet >> 18) & 63];
    out += alphabet[(triplet >> 12) & 63];
    out += b === undefined ? '=' : alphabet[(triplet >> 6) & 63];
    out += c === undefined || b === undefined ? '=' : alphabet[triplet & 63];
  }
  return out;
}

/** ImagePicker options that request base64 on web for durable URIs. */
export function visionPickerOptions<T extends Record<string, unknown>>(
  extra?: T,
): T & { quality: number; allowsEditing: false; base64?: true } {
  return {
    quality: 0.7,
    allowsEditing: false,
    ...(Platform.OS === 'web' ? { base64: true as const } : {}),
    ...(extra ?? ({} as T)),
  };
}

/**
 * Prefer a durable data: URI on web so analyze + album survive blob revoke.
 * Native file:/content: URIs are returned as-is.
 */
export async function persistPickerAsset(
  asset: ImagePickerAsset,
): Promise<string> {
  if (asset.base64) {
    const mime = asset.mimeType?.trim() || 'image/jpeg';
    return `data:${mime};base64,${asset.base64.replace(/\s/g, '')}`;
  }

  const uri = asset.uri;
  if (
    Platform.OS === 'web' &&
    (uri.startsWith('blob:') || uri.startsWith('http://') || uri.startsWith('https://'))
  ) {
    try {
      const res = await fetch(uri);
      if (!res.ok) return uri;
      const buf = await res.arrayBuffer();
      const b64 = bytesToBase64(new Uint8Array(buf));
      const mime =
        asset.mimeType?.trim() ||
        res.headers.get('content-type')?.split(';')[0]?.trim() ||
        'image/jpeg';
      return `data:${mime};base64,${b64}`;
    } catch {
      return uri;
    }
  }

  return uri;
}
