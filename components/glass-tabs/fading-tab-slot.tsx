import { useEffect, useRef, type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Screen } from 'react-native-screens';
import type { TabsDescriptor, TabsSlotRenderOptions } from 'expo-router/ui';

/** Strong ease-out — entering content should feel instant, then settle. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function FadeIn({ focused, children }: PropsWithChildren<{ focused: boolean }>) {
  const progress = useSharedValue(1);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Don't animate the very first screen on app launch.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (focused) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 220, easing: EASE_OUT });
    } else {
      // Outgoing screen hides instantly (display: none) — only entries animate.
      progress.value = 0;
    }
  }, [focused, progress]);

  const style = useAnimatedStyle(() => ({
    // Transform-only on purpose: animated opacity on an ancestor permanently
    // kills every GlassView on the screen after a tab switch (expo/expo#41024),
    // even once opacity settles back at 1. Same constraint as the tab bar's
    // entrance in app/(tabs)/_layout.tsx.
    // transform: [{ scale: interpolate(progress.value, [0, 1], [0.985, 1]) }],
  }));

  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}

/**
 * Drop-in for TabSlot's renderFn: identical to expo-router's default render,
 * plus a subtle micro-scale on the screen becoming focused (no fade — see
 * the GlassView note in FadeIn).
 */
export function renderFadingTabScreen(
  descriptor: TabsDescriptor,
  { isFocused, loaded, detachInactiveScreens }: TabsSlotRenderOptions,
) {
  const { lazy = true, unmountOnBlur, freezeOnBlur } = descriptor.options as {
    lazy?: boolean;
    unmountOnBlur?: boolean;
    freezeOnBlur?: boolean;
  };
  if (unmountOnBlur && !isFocused) {
    return null;
  }
  if (lazy && !loaded && !isFocused) {
    return null;
  }
  return (
    <Screen
      key={descriptor.route.key}
      enabled={detachInactiveScreens}
      activityState={isFocused ? 2 : 0}
      freezeOnBlur={freezeOnBlur}
      style={[styles.screen, isFocused ? styles.focused : styles.unfocused]}>
      <FadeIn focused={isFocused}>{descriptor.render()}</FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: 'relative',
    height: '100%',
  },
  focused: {
    zIndex: 1,
    display: 'flex',
    flexShrink: 0,
    flexGrow: 1,
  },
  unfocused: {
    zIndex: -1,
    display: 'none',
    flexShrink: 1,
    flexGrow: 0,
  },
});
