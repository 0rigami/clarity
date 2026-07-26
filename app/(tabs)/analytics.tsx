import {
  AnalyticsUpIcon,
  Clock01Icon,
  FireIcon,
  Mic01Icon,
  StarIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { GlassContainer } from 'expo-glass-effect';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecordsCard, type RecordRow } from '@/components/analytics/records-card';
import { SpeakingScoreCard } from '@/components/analytics/speaking-score-card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { useMinimizeOnScroll } from '@/components/glass-tabs';
import { HeaderActions } from '@/components/header-actions';
import { CounterCard, SkillCard } from '@/components/metrics';
import { SegmentedControl } from '@/components/segmented-control';
import { IntroReveal } from '@/components/splash';
import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { getPassage } from '@/constants/passages';
import { useSessionRecords } from '@/hooks/use-session-history';
import { useSpeakingSummary } from '@/hooks/use-speaking-summary';
import { formatDayRange, timeAgo } from '@/lib/format';
import { speakingScore } from '@/lib/score';
import { bestSession, longestStreakRange, totals } from '@/lib/stats';

const MODE_LABELS = { passage: 'Passage', drill: 'Drill', freestyle: 'Freestyle' } as const;

/** Only the week view is built. Month and all-time say so rather than showing a
 * week's data under the wrong label. */
const RANGES = ['Week', 'Month', 'All time'] as const;

export default function AnalyticsScreen() {
  const onScroll = useMinimizeOnScroll();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const colors = dark ? palette.dark : palette.light;
  const subtitleColor = dark ? '#9E9EA6' : '#77777E';

  const [range, setRange] = useState(0);
  const summary = useSpeakingSummary();
  const records = useSessionRecords();

  // All-time bests. Every value derives from the stored skills, so records
  // written before the score definition changed still rank correctly.
  const recordRows = useMemo<RecordRow[]>(() => {
    const best = bestSession(records);
    if (!best) return [];
    const t = totals(records);
    const longest = longestStreakRange(records);
    const rows: RecordRow[] = [
      {
        icon: StarIcon,
        title: 'Best score',
        caption: `${getPassage(best.passageId)?.title ?? MODE_LABELS[best.mode]} · ${timeAgo(
          best.completedAt,
          Date.now(),
        )}`,
        isScore: true,
        value: speakingScore(best) ?? 0,
      },
    ];
    if (longest) {
      rows.push({
        icon: FireIcon,
        title: 'Longest streak',
        caption: formatDayRange(longest.startMs, longest.endMs),
        value: longest.length,
        unit: longest.length === 1 ? 'day' : 'days',
      });
    }
    rows.push({
      icon: Clock01Icon,
      title: 'Total practice',
      caption: `across ${t.sessions} ${t.sessions === 1 ? 'session' : 'sessions'}`,
      value: t.minutes >= 60 ? Math.round(t.minutes / 60) : Math.round(t.minutes),
      unit: t.minutes >= 60 ? 'h' : 'min',
    });
    return rows;
  }, [records]);

  const header = (
    <>
      <View style={styles.header}>
        <IntroReveal order={0}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Analytics</Text>
        </IntroReveal>
        <IntroReveal order={0} fade={false}>
          <HeaderActions streak={summary.streak} />
        </IntroReveal>
      </View>
      <IntroReveal order={1} style={styles.control}>
        <SegmentedControl segments={RANGES} selectedIndex={range} onChange={setRange} />
      </IntroReveal>
    </>
  );

  const scroll = {
    onScroll,
    scrollEventThrottle: 16,
    style: { flex: 1 },
    contentContainerStyle: {
      paddingTop: insets.top + 24,
      paddingHorizontal: 20,
      paddingBottom: 140,
    },
  } as const;

  if (summary.empty || range !== 0) {
    return (
      <Animated.ScrollView {...scroll}>
        {header}
        <IntroReveal order={2} fade={false} style={styles.sectionCard}>
          <EmptyStateCard
            icon={AnalyticsUpIcon}
            title={summary.empty ? 'No analytics yet' : `${RANGES[range]} view is coming`}
            subtitle={
              summary.empty
                ? 'Finish a practice session and your speaking score, skills, and records will show up here.'
                : 'Only the weekly view is available right now. Switch back to Week to see your progress.'
            }
          />
        </IntroReveal>
      </Animated.ScrollView>
    );
  }

  return (
    <Animated.ScrollView {...scroll}>
      {header}

      <IntroReveal order={2} fade={false} style={styles.sectionCard}>
        <SpeakingScoreCard
          score={summary.score}
          delta={summary.scoreDelta ?? undefined}
          days={summary.days}
        />
      </IntroReveal>

      <IntroReveal order={3}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Skills</Text>
        <Text style={[styles.sectionSubtitle, { color: subtitleColor }]}>
          How each part of your speaking is trending
        </Text>
      </IntroReveal>
      <IntroReveal order={4} fade={false} style={styles.sectionCard}>
        <SkillCard
          skills={summary.skills}
          captions={summary.captions}
          deltas={summary.skillDeltas}
        />
      </IntroReveal>

      <IntroReveal order={5}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>This week</Text>
        <Text style={[styles.sectionSubtitle, { color: subtitleColor }]}>
          Your effort over the last seven days
        </Text>
      </IntroReveal>
      <IntroReveal order={6} fade={false} style={styles.sectionCard}>
        {/* Three counters, so the second row carries one full-width card rather
            than a half-width card beside a gap. GlassContainer groups all three
            so their glass composites as one set; `spacing` is left unset on
            purpose — raising it past the 10px gaps would fuse the cards into a
            single blob instead of keeping them a legible grid. */}
        <GlassContainer style={styles.counterGroup}>
          <View style={styles.counterRow}>
            <CounterCard
              icon={Clock01Icon}
              label="Practice time"
              value={summary.minutes}
              unit="min"
              delta={summary.minutesDelta}
              deltaSuffix="min"
            />
            <CounterCard
              icon={Mic01Icon}
              label="Sessions"
              value={summary.sessions}
              unit={summary.sessions === 1 ? 'run' : 'runs'}
              delta={summary.sessionsDelta}
            />
          </View>
          <View style={styles.counterRow}>
            <CounterCard
              icon={FireIcon}
              label="Day streak"
              value={summary.streak}
              unit={summary.streak === 1 ? 'day' : 'days'}
              delta={summary.streakDelta}
              deltaSuffix={Math.abs(summary.streakDelta) === 1 ? 'day' : 'days'}
            />
          </View>
        </GlassContainer>
      </IntroReveal>

      {recordRows.length > 0 && (
        <>
          <IntroReveal order={7}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Records</Text>
            <Text style={[styles.sectionSubtitle, { color: subtitleColor }]}>
              Your all-time bests
            </Text>
          </IntroReveal>
          <IntroReveal order={8} fade={false} style={styles.sectionCard}>
            <RecordsCard rows={recordRows} />
          </IntroReveal>
        </>
      )}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontSize: 34,
    fontFamily: fonts.bold,
    letterSpacing: -0.5,
  },
  control: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
    marginTop: 28,
  },
  sectionSubtitle: {
    fontSize: 15,
    fontFamily: fonts.regular,
    marginTop: 4,
    marginBottom: 4,
  },
  sectionCard: {
    marginTop: 12,
  },
  counterGroup: {
    gap: 10,
  },
  counterRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
