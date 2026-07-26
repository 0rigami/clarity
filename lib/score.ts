/**
 * Scoring math — the one definition of what a speaking score is.
 *
 * `sessionSkills` is the keystone: it encodes, once, which of the five skills a
 * given session actually measured. Both the session score (`services/scoring.ts`)
 * and every windowed score (`lib/stats.ts`, Analytics) derive from it, so the
 * hero number and the skill rows printed beneath it can't drift apart.
 *
 * PURE module — no React, no imports from `services/`. This sits at the bottom
 * of the dependency graph: `services/scoring.ts` and `lib/stats.ts` both import
 * from here, never the reverse. Runs under bun for `scripts/test-stats.ts`.
 */

import { SCORE_BANDS, SKILL_ORDER } from '@/constants/metrics';
import type { SessionMode, SkillEstimate, SkillKey, WordCounts } from '@/types/history';

export const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Pace as a 0–100 score: full marks inside ±10% of target, falling off either
 * side, floored at 30 so one bad read doesn't zero the skill. */
export function paceScore(paceWpm: number, targetWpm: number): number {
  if (paceWpm <= 0 || targetWpm <= 0) return 30;
  const ratio = paceWpm / targetWpm;
  let score: number;
  if (ratio >= 0.9 && ratio <= 1.1) score = 100;
  else if (ratio < 0.9) score = 100 - ((0.9 - ratio) / 0.3) * 50;
  else score = 100 - ((ratio - 1.1) / 0.4) * 50;
  return Math.round(Math.max(30, Math.min(100, score)));
}

/** Filler density as a 0–100 score. Duration is floored at 10s so a short take
 * isn't crushed by a single "um". */
export function fillerScore(fillerCount: number, durationMs: number): number {
  const minutes = Math.max(durationMs / 60_000, 1 / 6);
  const perMinute = fillerCount / minutes;
  return Math.round(Math.max(30, 100 - 12 * perMinute));
}

/**
 * Everything needed to score a session. Both `SessionRecord` and
 * `SessionResult` satisfy this structurally, so the same functions work on a
 * just-finished session and on persisted history — which is why no migration
 * or backfill is needed when the score definition changes.
 */
export type ScoreInput = {
  /** Absent means 'passage' (pre-freestyle results). */
  mode?: SessionMode;
  accuracy: number;
  fluency: number;
  intonation: number;
  paceWpm: number;
  targetWpm: number;
  fillerCount: number;
  durationMs: number;
  source: 'azure' | 'live';
};

/**
 * The five skills as 0–100, or null where this session couldn't measure one.
 *
 * Eligibility matters more than it looks: freestyle has no reference text, so
 * its accuracy is a meaningless 0, and intonation is a hardcoded placeholder
 * outside Azure. Both are excluded rather than averaged in — counting them as
 * zero would crater a freestyle session and anchor every live one to 70.
 */
export function sessionSkills(input: ScoreInput): Record<SkillKey, number | null> {
  const freestyle = input.mode === 'freestyle';
  return {
    accuracy: freestyle ? null : input.accuracy,
    fluency: input.fluency,
    pace: input.paceWpm > 0 ? paceScore(input.paceWpm, input.targetWpm) : null,
    fillers: fillerScore(input.fillerCount, input.durationMs),
    intonation: input.source === 'azure' ? input.intonation : null,
  };
}

/** Mean of the values that are present, or null when none are. */
function meanOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  return clampScore(present.reduce((sum, v) => sum + v, 0) / present.length);
}

/**
 * Plain (not EWMA) mean per skill across `inputs`, with a sample count so
 * callers can tell "no data" from a genuine low score. Used for windowed views
 * like "this week"; `skillProfile` in `lib/stats.ts` keeps the EWMA that drives
 * recommendations.
 */
export function skillWindow(inputs: readonly ScoreInput[]): Record<SkillKey, SkillEstimate> {
  const out = {} as Record<SkillKey, SkillEstimate>;
  for (const key of SKILL_ORDER) out[key] = { value: 0, samples: 0 };

  for (const input of inputs) {
    const skills = sessionSkills(input);
    for (const key of SKILL_ORDER) {
      const v = skills[key];
      if (v == null) continue;
      const estimate = out[key];
      estimate.value += v;
      estimate.samples += 1;
    }
  }

  for (const key of SKILL_ORDER) {
    const estimate = out[key];
    if (estimate.samples > 0) estimate.value = clampScore(estimate.value / estimate.samples);
  }
  return out;
}

/**
 * The speaking score: the mean of the five skills, over one session or a whole
 * window. null when nothing was measured — callers render an empty state rather
 * than a zero.
 *
 * For a window each skill is averaged first, then the skills are averaged, so
 * every skill counts equally no matter how many sessions were eligible for it.
 */
export function speakingScore(input: ScoreInput | readonly ScoreInput[]): number | null {
  if (Array.isArray(input)) {
    const window = skillWindow(input);
    return meanOf(SKILL_ORDER.map((key) => (window[key].samples > 0 ? window[key].value : null)));
  }
  const skills = sessionSkills(input as ScoreInput);
  return meanOf(SKILL_ORDER.map((key) => skills[key]));
}

/** Band label for a 0–100 score — the app's only score vocabulary. */
export function scoreBand(score: number): string {
  return SCORE_BANDS.find((band) => score >= band.min)?.label ?? SCORE_BANDS[SCORE_BANDS.length - 1].label;
}

/** The lowest-scoring skill with data — the one that earns the FOCUS pill.
 * null when fewer than two skills have data (nothing to single out). */
export function focusSkill(window: Record<SkillKey, SkillEstimate>): SkillKey | null {
  const known = SKILL_ORDER.filter((key) => window[key].samples > 0);
  if (known.length < 2) return null;
  return known.reduce((low, key) => (window[key].value < window[low].value ? key : low), known[0]);
}

/** Share of reference words spoken cleanly, 0–100 — the raw measure behind the
 * Articulation caption. null when no reference words were assessed (freestyle). */
export function cleanWordPct(counts: WordCounts): number | null {
  const assessed = counts.good + counts.mispronounced + counts.omitted;
  if (assessed === 0) return null;
  return Math.round((100 * counts.good) / assessed);
}

/** The raw measures behind the skill captions, in whatever units they were
 * actually measured in. Any of them may be null when the window had no eligible
 * session. */
export type RawMeasures = {
  /** Share of reference words spoken cleanly, 0–100. */
  cleanPct: number | null;
  avgWpm: number | null;
  targetWpm: number | null;
  /** Filler count — per session for a window, total for one session. */
  fillers: number | null;
};

/**
 * Captions that sit under each skill name, giving the raw measure so the units
 * live *below* the score instead of replacing it.
 *
 * Flow and Expression are deliberately absent: their raw measures (pauses over
 * ~1.5s, flat stretches) are never recorded, and inventing a caption from the
 * score would just restate the number. Wording lives here so the summary and
 * Analytics can't drift apart on it — only the filler framing differs.
 */
export function skillCaptions(
  raw: RawMeasures,
  framing: 'window' | 'session',
): Partial<Record<SkillKey, string>> {
  const out: Partial<Record<SkillKey, string>> = {};
  if (raw.cleanPct != null) out.accuracy = `${raw.cleanPct}% of words clean`;
  if (raw.avgWpm != null && raw.targetWpm != null) {
    out.pace = `${Math.round(raw.avgWpm)} wpm · target ${Math.round(raw.targetWpm)}`;
  }
  if (raw.fillers != null) {
    out.fillers =
      framing === 'window'
        ? `${raw.fillers} per session`
        : `${raw.fillers} used`;
  }
  return out;
}
