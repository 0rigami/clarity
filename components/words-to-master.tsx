import { PlayIcon, VolumeHighIcon } from '@hugeicons-pro/core-solid-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface, ThemedText } from '@/components/ui';
import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Row inset. Wider on the left than the card's own padding so the word column
 * lines up with the header summary above it. */
const ROW_INSET = spacing.xl;

/** Speaker button. 36pt of glyph inside a 44pt hit area via `hitSlop`. */
const SPEAKER_SIZE = 36;

export type WordToMaster = { word: string; count: number };

export type WordsToMasterProps = {
  words: readonly WordToMaster[];
  onPracticeAll: () => void;
  /** Play the word's pronunciation (TTS not wired yet — haptic-only for now). */
  onSpeak?: (word: string) => void;
};

/** "Words to master" body: a frosted card whose header pairs a count summary
 * with a "Practice all" pill, over one row per trouble word (frequency chip +
 * a tap-to-hear speaker). */
export function WordsToMaster({ words, onPracticeAll, onSpeak }: WordsToMasterProps) {
  const { colors } = useTheme();

  const handlePracticeAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPracticeAll();
  };

  const handleSpeak = (word: string) => {
    Haptics.selectionAsync();
    onSpeak?.(word);
  };

  return (
    <GlassSurface radius="lg" style={styles.card}>
      <View style={styles.header}>
        <ThemedText variant="subhead" tone="secondary">
          {words.length} {words.length === 1 ? 'word needs' : 'words need'} work
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={handlePracticeAll}
          style={({ pressed }) => [
            styles.practiceAll,
            { backgroundColor: colors.inverseSurface },
            pressed && styles.pressed,
          ]}>
          <HugeiconsIcon icon={PlayIcon} size={13} color={colors.inverseLabel} />
          <ThemedText variant="subhead" tone="inverse">
            Practice all
          </ThemedText>
        </Pressable>
      </View>

      {words.map((item, i) => (
        <Fragment key={item.word}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
          <View style={styles.row}>
            <View style={styles.wordGroup}>
              <ThemedText variant="callout" style={styles.word} numberOfLines={1}>
                {item.word}
              </ThemedText>
              <View style={[styles.chip, { backgroundColor: colors.fill }]}>
                <ThemedText variant="caption" weight="semibold" tone="tertiary">
                  {item.count}×
                </ThemedText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Hear ${item.word}`}
              onPress={() => handleSpeak(item.word)}
              hitSlop={spacing.sm}
              style={({ pressed }) => [
                styles.speaker,
                { backgroundColor: colors.fill },
                pressed && styles.pressedStrong,
              ]}>
              <HugeiconsIcon icon={VolumeHighIcon} size={19} color={colors.foreground} />
            </Pressable>
          </View>
        </Fragment>
      ))}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: ROW_INSET,
    paddingRight: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  practiceAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: ROW_INSET,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
  },
  wordGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  word: {
    flexShrink: 1,
  },
  chip: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
    borderCurve: 'continuous',
  },
  speaker: {
    width: SPEAKER_SIZE,
    height: SPEAKER_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ROW_INSET,
  },
  pressed: {
    opacity: 0.85,
  },
  pressedStrong: {
    opacity: 0.6,
  },
});
