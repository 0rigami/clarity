import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { metricColors } from '@/constants/metrics';
import { fonts } from '@/constants/fonts';

/**
 * A score, rendered the one way the app renders scores: the number in ink with
 * a muted `/100` beside it. Never a percentage — `%` is reserved for goal
 * progress (the daily-goal ring), so using it for a score would collide.
 *
 * The `/100` is sized relative to the value so the pair keeps its proportions
 * from the 19px record row up to the 56px results hero.
 */
export type ScoreValueProps = {
  /** 0–100, or null when the metric has no data yet (renders an em-less dash). */
  value: number | null;
  size: number;
  /** Defaults to `size * 0.37`, matching the design across every scale. */
  maxSize?: number;
};

export function ScoreValue({ value, size, maxSize }: ScoreValueProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = metricColors[scheme];
  const unitSize = maxSize ?? Math.round(size * 0.37);

  if (value == null) {
    return (
      <Text style={[styles.value, { color: theme.unit, fontSize: size, letterSpacing: 0 }]}>-</Text>
    );
  }

  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.value,
          { color: theme.ink, fontSize: size, letterSpacing: size * -0.028 },
        ]}>
        {Math.round(value)}
      </Text>
      <Text style={[styles.max, { color: theme.unit, fontSize: unitSize }]}>/100</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  value: {
    fontFamily: fonts.heavy,
  },
  max: {
    fontFamily: fonts.semibold,
  },
});
