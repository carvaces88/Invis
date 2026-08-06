/**
 * Live product vision config.
 *
 * Set in `.env` or `.env.local` (never commit secrets):
 *   EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
 * Optional:
 *   EXPO_PUBLIC_GEMINI_MODEL=gemini-2.0-flash
 *
 * Expo inlines EXPO_PUBLIC_* at bundle time — use a backend/Edge Function
 * proxy in production rather than shipping long-lived keys in the client.
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

/** True when a live Gemini key is configured (prefer real pixels over stub). */
export function isLiveVisionEnabled(): boolean {
  return Boolean(getGeminiApiKey());
}
