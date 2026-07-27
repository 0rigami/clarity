/**
 * The one resolved key-value backend, shared by every persistent store.
 *
 * MMKV is loaded through `require` inside a try/catch rather than a static
 * import, so a binary built before `react-native-mmkv` was added degrades to an
 * in-memory store instead of throwing while the module graph is still
 * evaluating — before any screen can mount and show an error.
 *
 * This lives apart from `services/storage.ts` (which owns the MMKV instance) and
 * from the stores above it so both `session-history` and `user-passages` get the
 * SAME backend and the SAME fallback. They previously disagreed: session history
 * guarded the call and fell back, while user passages went straight at MMKV and
 * red-screened the app on launch, because `lib/passage-catalog.ts` resolves
 * content ids outside React during the first render.
 */

import { createMemoryKv, type KvBackend } from '@/lib/history-store';

function resolve(): { kv: KvBackend; durable: boolean } {
  try {
    // Required lazily so a missing native module degrades instead of throwing
    // during module evaluation.
    const { mmkvBackend } = require('@/services/storage') as typeof import('@/services/storage');
    // Touch it once so a broken binding surfaces here rather than mid-render.
    mmkvBackend.contains('meta/probe');
    return { kv: mmkvBackend, durable: true };
  } catch (error) {
    console.warn('[storage] MMKV unavailable, falling back to memory', error);
    return { kv: createMemoryKv(), durable: false };
  }
}

/** `durable: false` means writes vanish on reload. Surfaced through
 * `getStorageStats()` so the degraded state is visible instead of looking like
 * silent data loss. */
export const { kv, durable } = resolve();
