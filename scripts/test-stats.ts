/**
 * Self-tests for derived practice statistics. Pure JS — run with:
 *   bun scripts/test-stats.ts
 */

import { formatDayRange } from '@/lib/format';
import {
  cleanWordPct,
  focusSkill,
  isScorable,
  scoreBand,
  sessionSkills,
  skillWindow,
  speakingScore,
} from '@/lib/score';
import {
  bestSession,
  DAILY_GOAL_MINUTES,
  dailySpeakingScores,
  dayKey,
  dayKeyAt,
  dayKeyToMs,
  dayKeyOffset,
  longestStreakRange,
  msUntilNextLocalMidnight,
  recordDayKey,
  recordsBetween,
  recordsSince,
  skillProfile,
  speakingSummary,
  startOfLocalDay,
  startOfLocalDayOffset,
  streak,
  todayProgress,
  topChallengingWords,
  totals,
  weeklyHistory,
} from '@/lib/stats';
import { RECORD_SCHEMA_VERSION, type SessionRecord } from '@/types/history';

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
  seq += 1;
  return {
    v: RECORD_SCHEMA_VERSION,
    id: `r${seq}`,
    seq,
    completedAt: NOW,
    // Fixed offset so day bucketing is identical on any host machine.
    tzOffsetMinutes: 0,
    mode: 'passage',
    endedReason: 'completed',
    passageId: 'epic-speech',
    contentTitle: 'The Epic Speech',
    durationMs: 120_000,
    // Consistent with wordCounts below, and comfortably over the scoring floor,
    // so the default fixture exercises the real gate rather than the
    // grandfathering path for records that predate the field.
    spokenWords: 95,
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
section('totals / bestSession / topChallengingWords');
{
  const recordsList = [
    rec({ completedAt: NOW - DAY, durationMs: 60_000, fillerCount: 3 }),
    rec({ completedAt: NOW - DAY, durationMs: 60_000, fillerCount: 1 }),
    rec({ completedAt: NOW, durationMs: 120_000 }),
  ];

  const t = totals(recordsList);
  assertEq(t.sessions, 3, 'total sessions');
  assertEq(t.longestStreak, 2, 'longest streak spans both days');
  // The best score is DERIVED from the five skills. There is no persisted score
  // field any more, which is the stronger version of the guarantee this used to
  // assert against a stale `overallScore`.
  assertEq(
    speakingScore(bestSession(recordsList)!),
    86,
    'best score derives from the stored skill inputs',
  );

  const gapped = [rec({ completedAt: NOW - 5 * DAY }), rec({ completedAt: NOW })];
  assertEq(totals(gapped).longestStreak, 1, 'gap resets longest streak');

  // An unscorable session must not become the user's "best" at zero.
  const unscorable = [rec({ endedReason: 'abandoned' })];
  assertEq(bestSession(unscorable), null, 'abandoned-only history has no best session');
  assertEq(totals(unscorable).sessions, 1, 'but it still counts as effort');

  const words = topChallengingWords(
    [rec({ challengingWords: ['Peck', 'butter'] }), rec({ challengingWords: ['peck'] })],
    5,
  );
  assertEq(words[0], { word: 'peck', count: 2 }, 'case-insensitive frequency ranking');

  // Fillers are filtered at read time, so history already on disk is fixed too.
  const withFiller = topChallengingWords([rec({ challengingWords: ['um', 'peck'] })], 5);
  assertEq(withFiller.map((w) => w.word), ['peck'], 'fillers are not words to master');
}

// ---------------------------------------------------------------------------
section('sessionSkills / speakingScore / skillWindow / scoreBand / focusSkill');
{
  // Default fixture: accuracy 85, fluency 82, pace 100 (on target), fillers 90
  // (2 over 2min → 1/min → 100 - 10), intonation 75. Mean = 86.4 → 86.
  const base = rec({});
  assertEq(speakingScore(base), 86, 'session score is the mean of the five skills');
  assertEq(sessionSkills(base).pace, 100, 'on-target pace scores 100');

  const freestyle = rec({ mode: 'freestyle', accuracy: 0, completeness: 0, source: 'live' });
  const fsSkills = sessionSkills(freestyle);
  assertEq(fsSkills.accuracy, null, 'freestyle has no articulation');
  assertEq(fsSkills.intonation, null, 'live source has no expression');
  // Only fluency 82, pace 100, fillers 90 count → 90.67 → 91.
  assertEq(speakingScore(freestyle), 91, 'freestyle scores on the three eligible skills');

  const live = rec({ source: 'live' });
  assertEq(sessionSkills(live).intonation, null, 'placeholder intonation excluded on live');
  // 85, 82, 100, 90 → 89.25 → 89. The excluded 75 would have dragged it to 86.
  assertEq(speakingScore(live), 89, 'live excludes rather than averages in the placeholder');

  const noPace = rec({ paceWpm: 0 });
  assertEq(sessionSkills(noPace).pace, null, 'zero WPM has no pacing sample');

  assertEq(speakingScore([]), null, 'empty window has no score');
  // mean(0, 0, pace 100, fillers 0, 0) = 20. Under the old floors of 30 on both
  // pace and fillers this was 26 and could not go lower, which is why the whole
  // 0-59 "Building" band was unreachable.
  assertEq(speakingScore(rec({ accuracy: 0, fluency: 0, intonation: 0, fillerCount: 999 })), 20,
    'a bad session now reaches the bottom of the range');

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

  // HALF-OPEN [since, until): the record at exactly `until` belongs to the next
  // window. With both ends inclusive it was counted in two adjacent windows at
  // once, inflating its own week-over-week delta.
  assertEq(recordsBetween(spread, NOW - DAY, NOW).length, 0, 'a record at `until` is excluded');
  assertEq(recordsBetween(spread, NOW - 3 * DAY, NOW).length, 1, 'only the older record is inside');
  assertEq(recordsBetween(spread, NOW - 3 * DAY, NOW + 1).length, 2, 'widening past it includes both');
  // The current window must be unbounded above, because `now` comes from a clock
  // that only ticks at midnight and can lag a just-saved session by hours.
  assertEq(recordsSince(spread, NOW - DAY).length, 1, 'recordsSince includes the newest record');
  assertEq(recordsSince(spread, NOW - 3 * DAY).length, 2, 'recordsSince includes both');

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
// ---------------------------------------------------------------------------
section('isScorable / the eligibility gate');
{
  // The two regressions this gate exists to prevent, asserted by the scores they
  // used to produce. 15s of silence: freestyle scored 81, a passage scored 72.
  const silentFreestyle = rec({
    mode: 'freestyle',
    accuracy: 0,
    completeness: 0,
    source: 'live',
    durationMs: 15_000,
    paceWpm: 0,
    fillerCount: 0,
    spokenWords: 0,
    wordCounts: { good: 0, mispronounced: 0, omitted: 0, inserted: 0 },
  });
  assertEq(speakingScore(silentFreestyle), null, '15s of freestyle silence used to score 81');

  const silentPassage = rec({
    source: 'live',
    durationMs: 15_000,
    paceWpm: 0,
    fillerCount: 0,
    spokenWords: 0,
    wordCounts: { good: 0, mispronounced: 0, omitted: 100, inserted: 0 },
  });
  assertEq(speakingScore(silentPassage), null, '15s of passage silence used to score 72');

  // Below the floor: no skills, but the effort still counts.
  const tooShort = rec({ durationMs: 4_000, spokenWords: 6 });
  assertEq(isScorable(tooShort), false, 'a few words in a few seconds is not scorable');
  assertEq(sessionSkills(tooShort).fluency, null, 'no skill samples below the floor');
  assertEq(totals([tooShort]).sessions, 1, 'but it counts as a session');
  assert(totals([tooShort]).minutes > 0, 'and its minutes count');
  assertEq(streak([tooShort], NOW), 1, 'and it keeps the streak alive');

  // Reason is checked before the numbers, so a recovered crash checkpoint full of
  // zeros never reaches a skill.
  for (const reason of ['abandoned', 'interrupted', 'error'] as const) {
    assertEq(isScorable(rec({ endedReason: reason })), false, `${reason} is not scorable`);
  }
  assertEq(isScorable(rec({ endedReason: 'stopped' })), true, 'stopped is scorable');
  assertEq(isScorable(rec({ endedReason: 'completed' })), true, 'completed is scorable');

  // Records written before the field existed can't be re-judged, so they are
  // trusted rather than retroactively unscored.
  const legacy = rec({ durationMs: 2_000 });
  delete (legacy as { spokenWords?: number }).spokenWords;
  assertEq(isScorable(legacy), true, 'a record with no spokenWords is grandfathered');
}

// ---------------------------------------------------------------------------
section('dayKeyAt / recordDayKey (timezone-stable bucketing)');
{
  // 00:30 on the 5th in Berlin (UTC+2 → offset -120).
  const berlinLateNight = Date.UTC(2026, 0, 4, 22, 30);
  assertEq(dayKeyAt(berlinLateNight, -120), '2026-01-05', 'Berlin sees the 5th');
  // The same instant in California (UTC-8 → offset 480) is still the 4th.
  assertEq(dayKeyAt(berlinLateNight, 480), '2026-01-04', 'California sees the 4th');

  // A record keeps the day it was practiced on even after the user flies.
  const practiced = rec({ completedAt: berlinLateNight, tzOffsetMinutes: -120 });
  assertEq(recordDayKey(practiced), '2026-01-05', 'the record keeps its Berlin day');

  // A streak spanning a westward flight neither breaks nor double-counts.
  const anchor = new Date(2026, 0, 10, 12, 0, 0).getTime();
  const flight = [
    rec({ completedAt: anchor - 2 * DAY, tzOffsetMinutes: -120 }),
    rec({ completedAt: anchor - DAY, tzOffsetMinutes: 480 }),
    rec({ completedAt: anchor, tzOffsetMinutes: 480 }),
  ];
  assertEq(new Set(flight.map(recordDayKey)).size, 3, 'three distinct practice days');

  // Falls back to the device zone when the offset is missing (migrated records).
  const noOffset = rec({ completedAt: NOW });
  delete (noOffset as { tzOffsetMinutes?: number }).tzOffsetMinutes;
  assertEq(recordDayKey(noOffset), dayKey(NOW), 'missing offset falls back to the device zone');
}

// ---------------------------------------------------------------------------
section('startOfLocalDay / msUntilNextLocalMidnight');
{
  const noon = new Date(2026, 5, 15, 12, 30, 45, 123).getTime();
  const midnight = startOfLocalDay(noon);
  assertEq(new Date(midnight).getHours(), 0, 'lands on local midnight');
  assertEq(startOfLocalDay(midnight), midnight, 'idempotent');

  // 11.5h from 12:30 to the next midnight, plus the 45.123s into the minute.
  assertEq(msUntilNextLocalMidnight(noon), 11 * 3_600_000 + 29 * 60_000 + 14_877,
    'counts down to the next local midnight');
  assert(msUntilNextLocalMidnight(midnight) > 0, 'never returns zero at midnight itself');
  // Clamped, so a skewed clock cannot produce a tight timer loop.
  assert(msUntilNextLocalMidnight(noon) <= 25 * 3_600_000, 'clamped to at most 25h');
}

// ---------------------------------------------------------------------------
section('speakingSummary');
{
  // The window is calendar-aligned, so the score is computed from exactly the
  // days the chart plots.
  const list = [
    rec({ completedAt: NOW - 2 * DAY }),
    rec({ completedAt: NOW }),
  ];
  const summary = speakingSummary(list, NOW);
  assertEq(summary.days.length, 7, 'seven plotted days');
  assertEq(summary.days[6].dayKey, dayKey(NOW), 'today is last');
  assertEq(summary.sessions, 2, 'both sessions are in the window');
  assertEq(summary.empty, false, 'not empty');

  // A session saved after the clock last ticked must still be in the window.
  const stale = NOW - 6 * 3_600_000;
  assertEq(speakingSummary([rec({ completedAt: NOW })], stale).sessions, 1,
    'a session newer than `now` still counts');

  // A day whose only session was unscorable reads "practiced, not scored".
  const partial = speakingSummary([rec({ completedAt: NOW, endedReason: 'abandoned' })], NOW);
  assertEq(partial.days[6].sessions, 1, 'the day has a session');
  assertEq(partial.days[6].score, null, 'but no score');
  assertEq(partial.days[6].skillCount, 0, 'and no skills');
  assert(partial.minutes > 0, 'the minutes still count');

  // A freestyle-only day is scored on fewer skills than a passage day, which is
  // what the chart marks rather than plotting them as equals.
  const fs = speakingSummary(
    [rec({ completedAt: NOW, mode: 'freestyle', accuracy: 0, source: 'live' })],
    NOW,
  );
  assertEq(fs.days[6].skillCount, 3, 'freestyle day scores on three skills');
  assertEq(speakingSummary([rec({ completedAt: NOW })], NOW).days[6].skillCount, 5,
    'passage+azure day scores on five');
}

// ---------------------------------------------------------------------------
section('DST-safe day stepping');
{
  // These only mean anything in a zone that observes DST; the npm script pins
  // TZ=America/New_York so the spring-forward boundary is real.
  const dstAware = new Date(2025, 2, 9).getTimezoneOffset() !==
    new Date(2025, 2, 10).getTimezoneOffset();

  if (dstAware) {
    // 00:30 on the morning AFTER spring-forward. Subtracting a fixed 86.4M ms
    // from here lands at 23:30 on Mar 8 and skips Mar 9 entirely.
    const afterSpringForward = new Date(2025, 2, 10, 0, 30).getTime();
    assertEq(dayKeyOffset(afterSpringForward, -1), '2025-03-09',
      'stepping back one day crosses spring-forward correctly');
    assertEq(dayKey(afterSpringForward - 86_400_000), '2025-03-08',
      'the fixed-ms step is the bug this replaces');

    // The streak must survive the transition.
    const across = [
      rec({ completedAt: new Date(2025, 2, 8, 12).getTime() }),
      rec({ completedAt: new Date(2025, 2, 9, 12).getTime() }),
      rec({ completedAt: new Date(2025, 2, 10, 12).getTime() }),
    ];
    assertEq(streak(across, afterSpringForward), 3,
      'a streak spanning spring-forward is not cut short');

    // And the day axis must not repeat or drop a day.
    const days = dailySpeakingScores(across, 5, afterSpringForward).map((d) => d.dayKey);
    assertEq(new Set(days).size, days.length, 'no duplicated day keys across DST');
    assert(days.includes('2025-03-09'), 'the transition day is plotted');

    // Fall-back is the mirror case.
    const afterFallBack = new Date(2025, 10, 3, 0, 30).getTime();
    assertEq(dayKeyOffset(afterFallBack, -1), '2025-11-02',
      'stepping back one day crosses fall-back correctly');
  } else {
    assertEq(dayKeyOffset(NOW, -1), dayKey(NOW - DAY), 'matches the naive step off-DST');
  }

  assertEq(startOfLocalDayOffset(NOW, 0), startOfLocalDay(NOW), 'zero offset is a no-op');
  assertEq(dayKeyOffset(NOW, 0), dayKey(NOW), 'zero offset keeps today');
}

// ---------------------------------------------------------------------------
section('speakingSummary: deltas need a prior window');
{
  // "All time" spans from the first session to today, so its comparison window
  // ends before any record exists. A delta equal to its own value is not a
  // change, so there is no delta to report.
  const list = [rec({ completedAt: NOW - 2 * DAY }), rec({ completedAt: NOW })];
  const allTime = speakingSummary(list, NOW, 3);
  assertEq(allTime.sessions, 2, 'both sessions are in the all-time window');
  assertEq(allTime.minutesDelta, null, 'no minutes delta without a prior window');
  assertEq(allTime.sessionsDelta, null, 'no sessions delta without a prior window');
  assertEq(allTime.streakDelta, null, 'no streak delta without a prior window');
  assertEq(allTime.scoreDelta, null, 'no score delta without a prior window');

  // With real history on both sides the deltas come back.
  const twoWindows = [
    rec({ completedAt: NOW - 9 * DAY }),
    rec({ completedAt: NOW - 8 * DAY }),
    rec({ completedAt: NOW }),
  ];
  const week = speakingSummary(twoWindows, NOW, 7);
  assertEq(week.sessions, 1, 'one session this week');
  assertEq(week.sessionsDelta, -1, 'compared against two the week before');
  assert(week.minutesDelta != null, 'minutes delta is reported when both sides exist');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
