/**
 * Live product vision config.
 *
 * Client (optional, inlined at build):
 *   EXPO_PUBLIC_GEMINI_API_KEY=...
 *   EXPO_PUBLIC_GEMINI_MODEL=gemini-3.6-flash
 *   EXPO_PUBLIC_GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
 *   EXPO_PUBLIC_VISION_URL=https://your-app.vercel.app/api/vision
 *   EXPO_PUBLIC_REMOVE_BG_URL=https://your-app.vercel.app/api/remove-bg
 *
 * Production preferred: set server-only GEMINI_API_KEY on Vercel for /api/vision
 * and /api/remove-bg so the key is not shipped in the web bundle.
 */
export function getGeminiApiKey(): string | undefined {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  return key || undefined;
}

export function getGeminiModel(): string {
  return (
    process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim() || 'gemini-3.6-flash'
  );
}

/** Image-edit model for catalog background cleanup. */
export function getGeminiImageModel(): string {
  return (
    process.env.EXPO_PUBLIC_GEMINI_IMAGE_MODEL?.trim() ||
    'gemini-2.5-flash-image'
  );
}

/** Same-origin or absolute URL for the serverless vision proxy. */
export function getVisionProxyUrl(): string | undefined {
  const explicit = process.env.EXPO_PUBLIC_VISION_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/vision`;
  }
  return undefined;
}

/** Same-origin or absolute URL for catalog photo background cleanup. */
export function getRemoveBgProxyUrl(): string | undefined {
  const explicit = process.env.EXPO_PUBLIC_REMOVE_BG_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/remove-bg`;
  }
  // Derive from vision URL when set to a remote host (native builds).
  const vision = process.env.EXPO_PUBLIC_VISION_URL?.trim();
  if (vision) {
    try {
      const u = new URL(vision);
      u.pathname = '/api/remove-bg';
      u.search = '';
      u.hash = '';
      return u.toString().replace(/\/$/, '');
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * True when we can attempt live photo reading (client key and/or vision proxy).
 * Demo stub (Figaro/capers) is only for explicit offline demos without a real photo.
 */
export function isLiveVisionEnabled(): boolean {
  return Boolean(getGeminiApiKey() || getVisionProxyUrl());
}

/** True when catalog photo background cleanup can be attempted. */
export function isRemoveBgEnabled(): boolean {
  return Boolean(getGeminiApiKey() || getRemoveBgProxyUrl());
}
