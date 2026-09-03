/**
 * Hard reload for installed Chrome “app” / PWA shells that cache the page
 * harder than a normal browser tab (no address-bar refresh).
 * Web only — no-op on native.
 */
export async function hardReloadApp(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }

  try {
    const sw = navigator.serviceWorker;
    if (sw?.getRegistrations) {
      const regs = await sw.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_refresh', String(Date.now()));
  window.location.replace(url.toString());
}
