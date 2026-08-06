/**
 * Live product vision config.
 *
 * Client (optional, inlined at build):
 *   EXPO_PUBLIC_GEMINI_API_KEY=...
 *   EXPO_PUBLIC_GEMINI_MODEL=gemini-2.0-flash
 *   EXPO_PUBLIC_VISION_URL=https://your-app.vercel.app/api/vision
 *
 * Production preferred: set server-only GEMINI_API_KEY on Vercel for /api/vision
 * so the key is not shipped in the web bundle.
 */
export function getGeminiApiKey(): string | undefined {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  return key || undefined;
}

export function getGeminiModel(): string {
  return (
    process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim() || 'gemini-2.0-flash'
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

/**
 * True when we can attempt live photo reading (client key and/or vision proxy).
 * Demo stub (Figaro/capers) is only for explicit offline demos without a real photo.
 */
export function isLiveVisionEnabled(): boolean {
  return Boolean(getGeminiApiKey() || getVisionProxyUrl());
}
