/**
 * Live-session presentation helpers.
 *
 * Score formatting and banding deliberately do NOT live here — they're in
 * `lib/score.ts` and `constants/metrics.ts` so every screen shares one
 * definition. This module is only for the in-session readouts, which describe
 * what's happening right now rather than scoring it.
 */

/** Live pace label for the practice header, e.g. "good pace". */
export function paceLabel(liveWpm: number, targetWpm: number): string {
  if (liveWpm <= 0) return 'warming up';
  const ratio = liveWpm / targetWpm;
  if (ratio > 1.25) return 'too fast';
  if (ratio > 1.1) return 'a bit fast';
  if (ratio < 0.75) return 'too slow';
  if (ratio < 0.9) return 'a bit slow';
  return 'good pace';
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
