import { useObserve } from 'expo-observe';
import { createContext, use, useEffect, useRef } from 'react';

/**
 * True once the launch splash has unmounted and touches reach the app.
 *
 * Defaults to true so a screen rendered outside the provider (tests, a future
 * entry point) still reports as soon as it is ready.
 */
const AppReadyContext = createContext(true);

/** Wraps the routes; fed the splash-finished flag by the root layout. */
export const AppReadyProvider = AppReadyContext.Provider;

/**
 * Reports Time to Interactive to EAS Observe for the screen that calls it.
 *
 * TTI is the one startup metric the library cannot measure on its own, and the
 * expo-router integration also needs a per-screen call to time each navigation.
 * Call this in every route component, near the top so it stays above any early
 * return.
 *
 * Two gates decide when the mark fires:
 * - `ready` — the screen's own content is on screen. Pass a flag for screens
 *   that render nothing until data arrives; omit it when the first render is
 *   already the finished screen.
 * - The splash overlay. It covers the app and swallows touches for ~2.3s after
 *   the first render, so on a cold launch the app is not interactive until it
 *   unmounts. Screens opened later see this flag already true.
 *
 * The mark runs once per mount. Repeat calls are harmless (Observe keeps the
 * first per screen), but there is no reason to make the native call again.
 */
export function useMarkInteractive(ready = true) {
  const { markInteractive } = useObserve();
  const appReady = use(AppReadyContext);
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current || !appReady || !ready) return;
    marked.current = true;
    markInteractive();
  }, [appReady, ready, markInteractive]);
}
