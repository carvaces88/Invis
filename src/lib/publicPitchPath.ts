import { Platform } from 'react-native';

/**
 * Public investor pitch URLs (web) — no login required.
 * https://invis-lac.vercel.app/pitch
 * https://invis-lac.vercel.app/investor
 */
export function isPublicPitchPath(pathname?: string): boolean {
  if (Platform.OS !== 'web') return false;
  const raw =
    pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '');
  const path = raw.replace(/\/+$/, '') || '/';
  return path === '/pitch' || path === '/investor';
}
