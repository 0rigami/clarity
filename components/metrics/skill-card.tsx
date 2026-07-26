import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { metricColors, SKILL_ORDER } from '@/constants/metrics';
import { focusSkill } from '@/lib/score';
import type { SkillEstimate, SkillKey } from '@/types/history';

import { SkillRow } from './skill-row';

/**
 * The five skills in one frosted card, always in `SKILL_ORDER`. Shared by the
 * session summary and Analytics, so the two screens can't disagree about which
 * skills exist, what they're called, or which one needs work.
 *
 * The FOCUS pill is placed here rather than by callers: it must land on exactly
 * one row, and deciding that per-screen is how you end up with two of them.
 */
export type SkillCardProps = {
  /** Per-skill score and sample count. `samples: 0` renders as "not measured". */
  skills: Record<SkillKey, SkillEstimate>;
  /** Per-skill raw-measure captions. Missing keys render no caption. */
  captions?: Partial<Record<SkillKey, string>>;
  /** Per-skill change vs the screen's comparison basis. */
  deltas?: Partial<Record<SkillKey, number>>;
};

export function SkillCard({ skills, captions, deltas }: SkillCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = metricColors[scheme];
  const hasGlass = isLiquidGlassAvailable();

  const focus = focusSkill(skills);

  const body = SKILL_ORDER.map((skill) => (
    <SkillRow
      key={skill}
      skill={skill}
      score={skills[skill].samples > 0 ? skills[skill].value : null}
      caption={captions?.[skill]}
      delta={deltas?.[skill]}
      focus={skill === focus}
    />
  ));

  return hasGlass ? (
    <GlassView
      glassEffectStyle="regular"
      style={[styles.card, { backgroundColor: theme.glassTint }]}>
      {body}
    </GlassView>
  ) : (
    <View style={[styles.card, { backgroundColor: theme.solidFallback }]}>{body}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 36,
    borderCurve: 'continuous',
    overflow: 'hidden',
    gap: 22,
  },
});
