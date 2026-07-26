/**
 * Self-tests for derived practice statistics. Pure JS — run with:
 *   bun scripts/test-stats.ts
 */

import { formatDayRange } from '@/lib/format';
import {
  cleanWordPct,
  focusSkill,
  scoreBand,
  sessionSkills,
  skillWindow,
  speakingScore,
} from '@/lib/score';
import {
  DAILY_GOAL_MINUTES,
  dailyAggregates,
  dailySpeakingScores,
  dayKey,
  dayKeyToMs,
  longestStreakRange,
  metricTrend,
  recordsBetween,
  skillProfile,
  streak,
  todayProgress,
  topChallengingWords,
  totals,
  weeklyHistory,
} from '@/lib/stats';
import type { SessionRecord } from '@/types/history';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
  );
}

function section(name: string) {
  console.log(`\n== ${name}`);
}

const DAY = 86_400_000;
// Fixed local-noon anchor so day math never straddles midnight in any TZ.
const NOW = new Date(2026, 6, 24, 12, 0, 0).getTime();

let seq = 0;
function rec(overrides: Partial<SessionRecord>): SessionRecord {
  return {
    id: `r${seq++}`,
    completedAt: NOW,
    mode: 'passage',
    passageId: 'epic-speech',
    durationMs: 120_000,
    overallScore: 80,
    accuracy: 85,
    fluency: 82,
    completeness: 90,
    intonation: 75,
    paceWpm: 150,
    targetWpm: 150,
    fillerCount: 2,
    source: 'azure',
    wordCounts: { good: 90, mispronounced: 5, omitted: 3, inserted: 2 },
    challengingWords: ['peck', 'pickled'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
section('dayKey');
{
  const d = new Date(2026, 0, 5, 23, 59).getTime();
  assertEq(dayKey(d), '2026-01-05', 'formats local YYYY-MM-DD with padding');

  // Regression guard: `new Date('2026-01-05')` parses as UTC midnight, which is
  // Jan 4 locally west of Greenwich. dayKeyToMs must round-trip in local time.
  assertEq(dayKey(dayKeyToMs('2026-01-05')), '2026-01-05', 'dayKeyToMs round-trips');
  assertEq(dayKey(dayKeyToMs(dayKey(d))), dayKey(d), 'round-trip is stable for a late-evening time');
  assertEq(new Date(dayKeyToMs('2026-01-05')).getHours(), 0, 'lands on local midnight');
}

// ---------------------------------------------------------------------------
section('streak');
{
  assertEq(streak([], NOW), 0, 'empty history → 0');
  assertEq(streak([rec({})], NOW), 1, 'session today → 1');
  assertEq(
    streak([rec({ completedAt: NOW - DAY })], NOW),
    1,
    'yesterday only (empty morning) → 1',
  );
  assertEq(
    streak([rec({ completedAt: NOW - 2 * DAY })], NOW),
    0,
    'gap: nothing today or yesterday → 0',
  );
  assertEq(
    streak(
      [rec({}), rec({ completedAt: NOW - DAY }), rec({ completedAt: NOW - 2 * DAY })],
      NOW,
    ),
    3,
    'three consecutive days → 3',
  );
  assertEq(
    streak(
      [rec({}), rec({ completedAt: NOW - DAY }), rec({ completedAt: NOW - 3 * DAY })],
      NOW,
    ),
    2,
    'gap two days back stops the count',
  );
  assertEq(
    streak([rec({}), rec({ completedAt: NOW - 3 * 60_000 })], NOW),
    1,
    'multiple sessions in one day count once',
  );
}

// ---------------------------------------------------------------------------
section('todayProgress / weeklyHistory');
{
  assertEq(todayProgress([], NOW), 0, 'empty → 0');
  const half = rec({ durationMs: (DAILY_GOAL_MINUTES / 2) * 60_000 });
  assert(Math.abs(todayProgress([half], NOW) - 0.5) < 1e-9, 'half the goal → 0.5');
  const over = rec({ durationMs: DAILY_GOAL_MINUTES * 2 * 60_000 });
  assertEq(todayProgress([over], NOW), 1, 'clamped at 1');

  const goalDay = (offset: number) =>
    rec({ completedAt: NOW - offset * DAY, durationMs: DAILY_GOAL_MINUTES * 60_000 });
  assertEq(
    weeklyHistory([goalDay(5), goalDay(1), rec({ completedAt: NOW - 2 * DAY })], NOW),
    [true, false, false, false, true],
    'oldest-first flags; short day misses goal',
  );
  assertEq(weeklyHistory([], NOW).length, 5, 'always 5 entries');
}

// ---------------------------------------------------------------------------
section('skillProfile');
{
  const empty = skillProfile([]);
  assertEq(empty.accuracy.samples, 0, 'empty → zero samples');

  // Live-source intonation must be excluded (hardcoded placeholder).
  const live = [rec({ source: 'live', intonation: 70 }), rec({ source: 'live' })];
  assertEq(skillProfile(live).intonation.samples, 0, 'live records excluded from intonation');
  assert(skillProfile(live).fluency.samples === 2, 'live records still count for fluency');

  // Freestyle excluded from accuracy.
  const freestyle = [rec({ mode: 'freestyle', accuracy: 0, source: 'live' })];
  assertEq(skillProfile(freestyle).accuracy.samples, 0, 'freestyle excluded from accuracy');

  // EWMA: newest sample dominates at α=0.3 vs a single seed.
  const drift = [
    rec({ completedAt: NOW - DAY, accuracy: 100 }),
    rec({ completedAt: NOW, accuracy: 50 }),
  ];
  const est = skillProfile(drift).accuracy;
  assertEq(est.samples, 2, 'two samples');
  assert(Math.abs(est.value - (0.3 * 50 + 0.7 * 100)) < 1e-9, 'EWMA seeded then blended', est);

  // Pace uses paceScore vs target: on-target reads score 100.
  const paced = [rec({ paceWpm: 150, targetWpm: 150 })];
  assertEq(skillProfile(paced).pace.value, 100, 'on-target pace → 100');
  const zero = [rec({ paceWpm: 0 })];
  assertEq(skillProfile(zero).pace.samples, 0, 'zero WPM excluded from pace');
}

// ---------------------------------------------------------------------------
section('dailyAggregates / totals / metricTrend / topChallengingWords');
{
  const recordsList = [
    rec({ completedAt: NOW - DAY, durationMs: 60_000, overallScore: 60, fillerCount: 3 }),
    rec({ completedAt: NOW - DAY, durationMs: 60_000, overallScore: 80, fillerCount: 1 }),
    rec({ completedAt: NOW, durationMs: 120_000, overallScore: 90 }),
  ];
  const series = dailyAggregates(recordsList, 3, NOW);
  assertEq(series.length, 3, 'one entry per day');
  assertEq(series[0].sessions, 0, 'empty day has zero sessions');
  assertEq(series[0].avgPace, null, 'empty day has null averages');
  assertEq(series[1].sessions, 2, 'yesterday grouped');
  assertEq(series[1].fillerRate, 2, 'fillers per active minute');
  assertEq(series[2].minutes, 2, "today's minutes");

  const t = totals(recordsList);
  assertEq(t.sessions, 3, 'total sessions');
  // 86, not the fixtures' persisted 90: the best score derives from the five
  // skills, so a record whose stored overallScore predates that definition
  // (or was never consistent with its own skills) can't inflate the best.
  assertEq(t.bestOverall, 86, 'best score derives from skills, not the persisted field');
  assertEq(t.longestStreak, 2, 'longest streak spans both days');

  const gapped = [rec({ completedAt: NOW - 5 * DAY }), rec({ completedAt: NOW })];
  assertEq(totals(gapped).longestStreak, 1, 'gap resets longest streak');

  const trend = metricTrend(recordsList, 'fluency', 2);
  assertEq(trend.map((p) => p.value), [82, 82], 'last-n, oldest first (stable within day)');

  const words = topChallengingWords(
    [rec({ challengingWords: ['Peck', 'butter'] }), rec({ challengingWords: ['peck'] })],
    5,
  );
  assertEq(words[0], { word: 'peck', count: 2 }, 'case-insensitive frequency ranking');
}

// ---------------------------------------------------------------------------
section('sessionSkills / speakingScore / skillWindow / scoreBand / focusSkill');
{
  // Default fixture: accuracy 85, fluency 82, pace 100 (on target), fillers 88
  // (2 over 2min → 1/min), intonation 75. Mean = 86.
  const base = rec({});
  assertEq(speakingScore(base), 86, 'session score is the mean of the five skills');
  assertEq(sessionSkills(base).pace, 100, 'on-target pace scores 100');

  const freestyle = rec({ mode: 'freestyle', accuracy: 0, completeness: 0, source: 'live' });
  const fsSkills = sessionSkills(freestyle);
  assertEq(fsSkills.accuracy, null, 'freestyle has no articulation');
  assertEq(fsSkills.intonation, null, 'live source has no expression');
  // Only fluency 82, pace 100, fillers 88 count → 90.
  assertEq(speakingScore(freestyle), 90, 'freestyle scores on the three eligible skills');

  const live = rec({ source: 'live' });
  assertEq(sessionSkills(live).intonation, null, 'placeholder intonation excluded on live');
  // 85, 82, 100, 88 → 88.75 → 89. The excluded 75 would have dragged it to 86.
  assertEq(speakingScore(live), 89, 'live excludes rather than averages in the placeholder');

  const noPace = rec({ paceWpm: 0 });
  assertEq(sessionSkills(noPace).pace, null, 'zero WPM has no pacing sample');

  assertEq(speakingScore([]), null, 'empty window has no score');
  assertEq(speakingScore(rec({ accuracy: 0, fluency: 0, intonation: 0, fillerCount: 999 })), 26,
    'a genuinely bad session still scores (floors are 30/0, not null)');

  // A window averages each skill first, then means the skills, so a skill
  // measured by only one session still counts equally.
  const window = skillWindow([base, freestyle]);
  assertEq(window.accuracy.samples, 1, 'only the passage session measured articulation');
  assertEq(window.accuracy.value, 85, 'single-sample skill keeps its value');
  assertEq(window.fluency.samples, 2, 'both sessions measured flow');
  assertEq(window.intonation.samples, 1, 'only the azure session measured expression');
  assertEq(skillWindow([]).fluency.samples, 0, 'empty window has no samples');

  assertEq(focusSkill(skillWindow([base])), 'intonation', 'lowest scoring skill takes focus');
  assertEq(focusSkill(skillWindow([])), null, 'no focus without data');
  // Flow and Fillers are always eligible, so a freestyle+live+no-pace session
  // still has two scored skills and focus falls to the lower of them.
  assertEq(focusSkill(skillWindow([rec({ paceWpm: 0, source: 'live', mode: 'freestyle' })])),
    'fluency', 'focus picks the lower of the two always-eligible skills');

  assertEq(scoreBand(90), 'Orator', 'band boundary 90');
  assertEq(scoreBand(89), 'Strong', 'just below 90');
  assertEq(scoreBand(75), 'Strong', 'band boundary 75');
  assertEq(scoreBand(74), 'Steady', 'just below 75');
  assertEq(scoreBand(60), 'Steady', 'band boundary 60');
  assertEq(scoreBand(59), 'Building', 'just below 60');
  assertEq(scoreBand(0), 'Building', 'floor');

  assertEq(cleanWordPct({ good: 90, mispronounced: 5, omitted: 5, inserted: 3 }), 90,
    'clean share ignores insertions');
  assertEq(cleanWordPct({ good: 0, mispronounced: 0, omitted: 0, inserted: 4 }), null,
    'no assessed words → no clean share');
}

// ---------------------------------------------------------------------------
section('dailySpeakingScores / recordsBetween / longestStreakRange');
{
  const spread = [
    rec({ completedAt: NOW - 2 * DAY }),
    rec({ completedAt: NOW, fillerCount: 0 }),
  ];
  const daily = dailySpeakingScores(spread, 3, NOW);
  assertEq(daily.length, 3, 'one entry per day');
  assertEq(daily[0].score, 86, 'two days ago scored');
  assertEq(daily[1].score, null, 'gap day has no score, not a zero');
  assertEq(daily[2].score, 88, 'today scored (no fillers → 100)');
  assertEq(dailySpeakingScores([], 7, NOW).filter((d) => d.score != null).length, 0,
    'no history → every day null');

  assertEq(recordsBetween(spread, NOW - DAY, NOW).length, 1, 'window excludes older records');
  assertEq(recordsBetween(spread, NOW - 3 * DAY, NOW).length, 2, 'wider window includes both');

  assertEq(longestStreakRange([]), null, 'no history has no streak range');
  const single = longestStreakRange([rec({ completedAt: NOW })])!;
  assertEq(single.length, 1, 'single day is a one-day streak');
  assertEq(single.startMs, single.endMs, 'single day range collapses');

  // Two runs: a 3-day run, then a gap, then a 2-day run. The longer one wins.
  const runs = [
    rec({ completedAt: NOW - 9 * DAY }),
    rec({ completedAt: NOW - 8 * DAY }),
    rec({ completedAt: NOW - 7 * DAY }),
    rec({ completedAt: NOW - DAY }),
    rec({ completedAt: NOW }),
  ];
  const range = longestStreakRange(runs)!;
  assertEq(range.length, 3, 'longest of two runs');
  assertEq(dayKey(range.startMs), dayKey(NOW - 9 * DAY), 'range starts at the run start');
  assertEq(dayKey(range.endMs), dayKey(NOW - 7 * DAY), 'range ends at the run end');
  assertEq(formatDayRange(range.startMs, range.endMs).includes('–'), true, 'multi-day uses en dash');
  assertEq(formatDayRange(single.startMs, single.endMs).includes('–'), false, 'single day has no dash');
}

// ---------------------------------------------------------------------------
section('recommend');
{
  const { recommend, FREESTYLE_ID_PREFIX } = await import('@/lib/recommendations');

  const cold = recommend([], skillProfile([]));
  assertEq(cold.weakest, null, 'cold start has no weakest skill');
  assertEq(cold.reason, null, 'cold start uses default subtitle');
  assert(cold.items.length === 4, 'cold start returns starter set', cold.items.map((i) => i.id));
  assert(
    cold.items.some((i) => i.id.startsWith(FREESTYLE_ID_PREFIX)),
    'cold start includes a freestyle card',
  );

  // Five sessions with weak pace (way over target) and everything else strong.
  const slow = Array.from({ length: 5 }, (_, i) =>
    rec({
      completedAt: NOW - i * DAY,
      paceWpm: 220,
      targetWpm: 150,
      accuracy: 95,
      fluency: 95,
      intonation: 95,
      fillerCount: 0,
    }),
  );
  const paceRec = recommend(slow, skillProfile(slow));
  assertEq(paceRec.weakest, 'pace', 'weak pace detected');
  assert(
    paceRec.items.some((i) => i.id === 'drill-slow-read' || i.id === 'drill-brisk-read'),
    'pace recommendation includes a pacing drill',
    paceRec.items.map((i) => i.id),
  );
  assert(
    paceRec.items.every((i) => i.id !== 'epic-speech' || slow[0].passageId !== 'epic-speech'),
    'most recent passage excluded',
  );

  // Heavy fillers → freestyle pinned first.
  const filler = Array.from({ length: 5 }, (_, i) =>
    rec({
      completedAt: NOW - i * DAY,
      fillerCount: 20,
      durationMs: 60_000,
      accuracy: 95,
      fluency: 95,
      intonation: 95,
    }),
  );
  const fillerRec = recommend(filler, skillProfile(filler));
  assertEq(fillerRec.weakest, 'fillers', 'weak fillers detected');
  assert(
    fillerRec.items[0].id.startsWith(FREESTYLE_ID_PREFIX),
    'freestyle pinned first for fillers',
    fillerRec.items.map((i) => i.id),
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
