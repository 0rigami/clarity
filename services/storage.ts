/**
 * The app's one persistent key-value store, backed by MMKV.
 *
 * MMKV is memory-mapped and synchronous, which is a hard requirement here rather
 * than a preference: `lib/passage-catalog.ts` resolves content ids outside React
 * during the first render, and both stores feed `useSyncExternalStore`, whose
 * `getSnapshot` must be synchronous. An async store would force a gate into boot.
 *
 * This module is the ONLY place that touches `react-native-mmkv`. Everything
 * above it talks to the `KvBackend` interface in `lib/history-store.ts`, so the
 * store logic — including migration and quarantine, the riskiest parts — is
 * testable under bun against an in-memory backend.
 */

import { createMMKV } from 'react-native-mmkv';

import type { KvBackend } from '@/lib/history-store';

let instance: ReturnType<typeof createMMKV> | null = null;

/** Lazily created so importing this module has no native side effect. */
function mmkv() {
  if (!instance) {
    instance = createMMKV({
      id: 'cadence.v1',
      // Practice history is the one thing in this app that cannot be
      // regenerated, so prefer salvaging a damaged file over dropping it.
      recoveryStrategy: 'recover-on-error',
    });
  }
  return instance;
}

export const mmkvBackend: KvBackend = {
  getString: (key) => mmkv().getString(key),
  getNumber: (key) => mmkv().getNumber(key),
  getBoolean: (key) => mmkv().getBoolean(key),
  set: (key, value) => mmkv().set(key, value),
  remove: (key) => mmkv().remove(key),
  contains: (key) => mmkv().contains(key),
  getAllKeys: () => mmkv().getAllKeys(),
  clearAll: () => mmkv().clearAll(),
  trim: () => mmkv().trim(),
};

/** Diagnostics for the dev handle: how much space history is actually using. */
export function storageInfo(): { keys: number; byteSize: number } {
  const store = mmkv();
  return { keys: store.length, byteSize: store.byteSize };
}
