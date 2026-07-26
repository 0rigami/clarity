import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
import { StyleSheet, Text, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts } from '@/constants/fonts';
import { metricColors } from '@/constants/metrics';

import { DeltaLabel } from './delta-label';

/**
 * One effort counter: labelled icon, a big value with its unit, and the change
 * since last week. Solid rather than frosted — the design keeps the small
 * counters opaque so they read as a grid against the glass cards above them.
 *
 * The value is always ink. Effort is effort; there's no "good" or "bad" amount
 * of practice to color it by.
 */
export type CounterCardProps = {
  icon: IconSvgElement;
  label: string;
  value: number;
  /** Sits after the value, e.g. "min", "runs", "days". */
  unit: string;
  /** Week-over-week change. Omit for a counter with no comparison. */
  delta?: number;
  /** Appended after the delta number, e.g. "min" in "↑ 12 min". */
  deltaSuffix?: string;
  style?: StyleProp<ViewStyle>;
};

export function CounterCard({
  icon,
  label,
  value,
  unit,
  delta,
  deltaSuffix,
  style,
}: CounterCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = metricColors[scheme];

  return (
    <View style={[styles.card, { backgroundColor: theme.card }, style]}>
      <View style={styles.header}>
        <HugeiconsIcon icon={icon} size={15} color={theme.unit} strokeWidth={1.9} />
        <Text style={[styles.label, { color: theme.label }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.values}>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: theme.ink }]}>{value}</Text>
          <Text style={[styles.unit, { color: theme.unit }]}>{unit}</Text>
        </View>
        {/* Reserve the delta line even when absent so cards in a row align. */}
        <View style={styles.deltaSlot}>
          {delta != null && <DeltaLabel delta={delta} suffix={deltaSuffix} hideZero />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 26,
    borderCurve: 'continuous',
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.medium,
    flexShrink: 1,
  },
  values: {
    gap: 3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  value: {
    fontSize: 26,
    fontFamily: fonts.heavy,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  deltaSlot: {
    height: 16,
    justifyContent: 'center',
  },
});
