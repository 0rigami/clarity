import { Host, Text } from '@expo/ui/swift-ui';
import {
  animation,
  Animation,
  contentTransition,
  font,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';

import type { AnimatedRoundedNumberProps } from './animated-rounded-number';

/** Native rolling-number treatment, isolated so non-iOS bundles never load SwiftUI. */
export function AnimatedRoundedNumber({
  text,
  value,
  color,
  fontSize,
  weight,
  duration,
}: AnimatedRoundedNumberProps) {
  return (
    // ignoreSafeArea: the hosting view otherwise applies the notch/home-bar
    // insets to the SwiftUI text whenever a value change triggers layout while
    // the host overlaps a safe area (scrolled under the Dynamic Island, or
    // mid navigation transition), leaving the digits pushed ~12pt off-center.
    <Host matchContents ignoreSafeArea="all">
      <Text
        modifiers={[
          contentTransition('numericText'),
          animation(Animation.spring({ duration }), value),
          font({ size: fontSize, weight, design: 'rounded' }),
          foregroundStyle(color),
        ]}>
        {text}
      </Text>
    </Host>
  );
}
