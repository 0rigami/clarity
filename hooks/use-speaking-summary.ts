import { useMemo } from 'react';

import { speakingSummary, WINDOW_DAYS, type SpeakingSummary } from '@/lib/stats';
import { useSessionRecords } from '@/hooks/use-session-history';
import { useNow } from '@/hooks/use-now';

export type { SpeakingSummary } from '@/lib/stats';

/**
 * The rolling picture of a user's speaking, shared by Home and Analytics so the
 * two screens can never show different figures for the same window.
 *
 * The math lives in `lib/stats.ts#speakingSummary` (pure, and asserted under
 * bun); this hook only supplies the records and the one shared `now`. Because
 * both screens read the same clock value, "they agree" is now structural rather
 * than a comment.
 *
 * @param windowDays Days in the window. Analytics passes 7 / 30, or the full
 *   span of history for the all-time range.
 */
export function useSpeakingSummary(
  windowDays: number = WINDOW_DAYS,
  chartDays: number = windowDays,
): SpeakingSummary {
  const records = useSessionRecords();
  const now = useNow();
  return useMemo(
    () => speakingSummary(records, now, windowDays, chartDays),
    [records, now, windowDays, chartDays],
  );
}
