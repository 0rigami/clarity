import { useMemo } from 'react';

import { skillCaptions, skillWindow, speakingScore } from '@/lib/score';
import {
  dailySpeakingScores,
  recordsBetween,
  streak,
  windowRawMeasures,
} from '@/lib/stats';
import { useSessionRecords } from '@/hooks/use-session-history';
import type { SkillEstimate, SkillKey } from '@/types/history';

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 7;

export type SpeakingSummary = {
  /** True when there's no history at all — screens show an empty state. */
  empty: boolean;
  /** Rolling 7-day speaking score; null when nothing in the window was measured. */
  score: number | null;
  /** Change vs the previous 7 days; null without prior data to compare. */
  scoreDelta: number | null;
  /** Per-day scores across the plotted window, oldest first, today last. */
  days: { dayKey: string; score: number | null }[];
  skills: Record<SkillKey, SkillEstimate>;
  /** Per-skill change vs the previous 7 days; only set where both windows have data. */
  skillDeltas: Partial<Record<SkillKey, number>>;
  captions: Partial<Record<SkillKey, string>>;
  minutes: number;
  minutesDelta: number;
  sessions: number;
  sessionsDelta: number;
  streak: number;
  streakDelta: number;
};

/**
 * The rolling 7-day picture of a user's speaking, derived once and shared by
 * Home and Analytics so the two screens can never show different figures for
 * the same week.
 *
 * Everything is computed from a single `now` and a single pair of window slices,
 * so the score, the chart, the skills, and the counters all agree about which
 * sessions "this week" means.
 */
export function useSpeakingSummary(): SpeakingSummary {
  const records = useSessionRecords();

  return useMemo(() => {
    const now = Date.now();
    const weekStart = now - WINDOW_DAYS * DAY_MS;
    const thisWeek = recordsBetween(records, weekStart, now);
    const lastWeek = recordsBetween(records, weekStart - WINDOW_DAYS * DAY_MS, weekStart);

    const score = speakingScore(thisWeek);
    const priorScore = speakingScore(lastWeek);

    const skills = skillWindow(thisWeek);
    const priorSkills = skillWindow(lastWeek);
    const skillDeltas: Partial<Record<SkillKey, number>> = {};
    for (const key of Object.keys(skills) as SkillKey[]) {
      // A delta needs both sides measured; "improved from nothing" isn't a fact.
      if (skills[key].samples > 0 && priorSkills[key].samples > 0) {
        skillDeltas[key] = skills[key].value - priorSkills[key].value;
      }
    }

    const minutes = Math.round(
      thisWeek.reduce((sum, r) => sum + r.durationMs / 60_000, 0),
    );
    const priorMinutes = Math.round(
      lastWeek.reduce((sum, r) => sum + r.durationMs / 60_000, 0),
    );
    const currentStreak = streak(records, now);

    return {
      empty: records.length === 0,
      score,
      scoreDelta: score != null && priorScore != null ? score - priorScore : null,
      days: dailySpeakingScores(records, WINDOW_DAYS, now),
      skills,
      skillDeltas,
      captions: skillCaptions(windowRawMeasures(thisWeek), 'window'),
      minutes,
      minutesDelta: minutes - priorMinutes,
      sessions: thisWeek.length,
      sessionsDelta: thisWeek.length - lastWeek.length,
      streak: currentStreak,
      streakDelta: currentStreak - streak(records, weekStart),
    };
  }, [records]);
}
