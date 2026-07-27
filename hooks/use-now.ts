import { useSyncExternalStore } from 'react';

import { getNow, subscribe } from '@/services/clock';

/**
 * The shared "now", stable between ticks so it is safe in `useMemo` deps.
 * Advances at local midnight and on app foreground — see `services/clock.ts`.
 *
 * Every screen that shows a day-based figure must read from here rather than
 * calling `Date.now()`, or the figures drift apart between screens.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getNow, getNow);
}
