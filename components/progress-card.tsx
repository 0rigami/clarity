import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { DeltaLabel, ScoreValue, TickBar } from '@/components/metrics';
import { fonts } from '@/constants/fonts';
import { metricColors, type MetricColors } from '@/constants/metrics';
import { scoreBand } from '@/lib/score';

/** Ticks in the hero meter. Denser than the skill bars because this one spans
 * the full card width with no trailing score to leave room for. */
const TICK_COUNT = 35;

const THEME = {
  light: {
    badgeBg: '#1C1C21',
    badgeText: '#FFFFFF',
    divider: '#E4E4E9',
  },
  dark: {
    badgeBg: '#F2F2F5',
    badgeText: '#111114',
    divider: 'rgba(255,255,255,0.12)',
  },
} as const;

export type ProgressCardProps = {
  /** Rolling 7-day speaking score; null when the week has nothing measured. */
  score: number | null;
  /** Change vs the previous 7 days. Omit when there's no prior week. */
  scoreDelta?: number;
  totalMinutes: number;
  totalSessions: number;
  longestStreak: number;
};

/** One all-time stat: big value plus a muted label beneath. */
function Stat({
  value,
  unit,
  label,
  theme,
}: {
  value: string;
  unit: string;
  label: string;
  theme: MetricColors;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <Text style={[styles.statValue, { color: theme.ink }]}>{value}</Text>
        <Text style={[styles.statUnit, { color: theme.unit }]}>{unit}</Text>
      </View>
      <Text style={[styles.statLabel, { color: theme.unit }]}>{label}</Text>
    </View>
  );
}

/**
 * "Your progress": where a user's speaking stands right now.
 *
 * The hero is the same rolling 7-day speaking score Analytics leads with — not
 * a personal best — so opening either screen shows the same number. All-time
 * totals sit underneath, and the week's change lives in the hero rather than
 * being repeated per stat.
 */
export function ProgressCard({
  score,
  scoreDelta,
  totalMinutes,
  totalSessions,
  longestStreak,
}: ProgressCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = metricColors[scheme];
  const chrome = THEME[scheme];
  const hasGlass = isLiquidGlassAvailable();
  const hours = totalMinutes >= 60 ? Math.round(totalMinutes / 60) : null;

  const heroBody = (
    <>
      <Text style={[styles.eyebrow, { color: theme.label }]}>SPEAKING SCORE</Text>
      <View style={styles.scoreRow}>
        <ScoreValue value={score} size={40} maxSize={18} />
        {score != null && (
          <View style={[styles.badge, { backgroundColor: chrome.badgeBg }]}>
            <Text style={[styles.badgeLabel, { color: chrome.badgeText }]}>
              {scoreBand(score).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <TickBar fill={score != null ? score / 100 : 0} tickCount={TICK_COUNT} height={20} />
      <View style={styles.metaRow}>
        <Text style={[styles.metaLabel, { color: theme.label }]}>Last 7 days</Text>
        {scoreDelta != null && scoreDelta !== 0 && (
          <DeltaLabel delta={scoreDelta} suffix="this week" />
        )}
      </View>
    </>
  );

  return (
    <View>
      {hasGlass ? (
        <GlassView
          glassEffectStyle="regular"
          style={[styles.hero, { backgroundColor: theme.glassTint }]}>
          {heroBody}
        </GlassView>
      ) : (
        <View style={[styles.hero, { backgroundColor: theme.solidFallback }]}>{heroBody}</View>
      )}

      <View style={styles.momentum}>
        <Stat
          value={String(hours ?? Math.round(totalMinutes))}
          unit={hours != null ? 'h' : 'min'}
          label="practice"
          theme={theme}
        />
        <View style={[styles.momentumDivider, { backgroundColor: chrome.divider }]} />
        <Stat
          value={String(totalSessions)}
          unit=""
          label={totalSessions === 1 ? 'session' : 'sessions'}
          theme={theme}
        />
        <View style={[styles.momentumDivider, { backgroundColor: chrome.divider }]} />
        <Stat
          value={String(longestStreak)}
          unit={longestStreak === 1 ? 'day' : 'days'}
          label="best streak"
          theme={theme}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 20,
    borderRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: fonts.bold,
    letterSpacing: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 50,
    borderCurve: 'continuous',
  },
  badgeLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  momentum: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 2,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statValue: {
    fontSize: 21,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
  statUnit: {
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  momentumDivider: {
    width: 1,
    height: 34,
  },
});
