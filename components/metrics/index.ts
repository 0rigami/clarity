/** Shared metric render primitives. Every screen that shows a number composes
 * these, so the app's units, color rule, and skill vocabulary stay in one place.
 * The data they render comes from `lib/score.ts`. */
export { CounterCard, type CounterCardProps } from './counter-card';
export { DeltaLabel, type DeltaLabelProps } from './delta-label';
export { ScoreValue, type ScoreValueProps } from './score-value';
export { SkillCard, type SkillCardProps } from './skill-card';
export { SkillRow, type SkillRowProps } from './skill-row';
export { TickBar, type TickBarProps } from './tick-bar';
