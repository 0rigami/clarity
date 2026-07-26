import { Text } from 'react-native';

export type AnimatedRoundedNumberProps = {
  text: string;
  value: number;
  color: string;
  fontSize: number;
  fontFamily: string;
  /** Subset of SwiftUI's Font.Weight the app actually uses. */
  weight: 'semibold' | 'bold' | 'heavy';
  duration: number;
};

/** Android/web fallback for the iOS SwiftUI numeric-text transition. */
export function AnimatedRoundedNumber({
  text,
  color,
  fontSize,
  fontFamily,
}: AnimatedRoundedNumberProps) {
  return <Text style={{ color, fontSize, fontFamily }}>{text}</Text>;
}
