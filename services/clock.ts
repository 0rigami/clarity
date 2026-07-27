/**
 * The app's one "now".
 *
 * Every day-based figure (streak, today's goal ring, the weekly window, the day
 * chart) used to snapshot `Date.now()` inside a `useMemo` keyed only on records.
 * Two consequences: leaving the app open across midnight froze all of them at
 * yesterday's boundaries until the next save, and Home and Analytics each held
 * their own `now`, so the two screens could legitimately disagree about what
 * "this week" meant.
 *
 * This is a single external store that advances on exactly two events: the local
 * midnight boundary, and the app returning to the foreground. No polling — one
 * scheduled timeout, re-armed on each tick.
 */

import { AppState, type NativeEventSubscription } from 'react-native';

import { msUntilNextLocalMidnight } from '@/lib/stats';

/**
 * Cached rather than read per call. `getSnapshot` must return a stable value
 * between ticks: handing `useSyncExternalStore` a fresh `Date.now()` every call
 * is the classic infinite-render trap.
 */
let cached = Date.now();
let override: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: NativeEventSubscription | null = null;
const listeners = new Set<() => void>();

function schedule() {
  if (timer) clearTimeout(timer);
  // The half-second cushion keeps a timer that fires a hair early from landing
  // back on the same calendar day and re-arming for ~0ms.
  timer = setTimeout(tick, msUntilNextLocalMidnight(cached) + 500);
}

function tick() {
  cached = override ?? Date.now();
  schedule();
  for (const listener of listeners) listener();
}

export function getNow(): number {
  return cached;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    cached = override ?? Date.now();
    schedule();
    // iOS suspends JS timers while backgrounded, so the midnight timeout alone
    // cannot be trusted; the foreground event is what actually catches a day
    // rollover that happened while the app was away.
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer) clearTimeout(timer);
      timer = null;
      appStateSub?.remove();
      appStateSub = null;
    }
  };
}

/** __DEV__ only: pin the clock to test a day rollover without waiting for one.
 * Pass null to return to real time. */
export function setNowOverride(ms: number | null) {
  override = ms;
  tick();
}
