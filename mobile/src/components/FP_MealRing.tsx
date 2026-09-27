import React from 'react';
import { StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { FP_COLORS } from '../theme';
import FP_ProgressRing from './FP_ProgressRing';

export interface FP_MealRingProps {
  consumedKcal: number;
  targetKcal: number;
  /** 120/92 on the nutrition screen, 64/48 on the home summary card */
  size?: number;
  innerSize?: number;
  /** 'kcal' prints "1,480 / 2,100 kcal"; 'percent' just the percentage */
  variant?: 'kcal' | 'percent';
  /** CMS-supplied "/ {target} kcal" line */
  targetLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** `.meal-ring` — the same donut as FP_ProgressRing, labelled with calories. */
export const FP_MealRing: React.FC<FP_MealRingProps> = ({
  consumedKcal,
  targetKcal,
  size = 120,
  innerSize = 92,
  variant = 'kcal',
  targetLabel,
  style,
}) => {
  const pct = targetKcal > 0 ? consumedKcal / targetKcal : 0;
  return (
    <FP_ProgressRing progress={pct} size={size} innerSize={innerSize} style={style}>
      {variant === 'kcal' ? (
        <>
          <Text style={styles.big}>{consumedKcal.toLocaleString()}</Text>
          {targetLabel ? <Text style={styles.sub}>{targetLabel}</Text> : null}
        </>
      ) : (
        <Text style={styles.pct}>{Math.round(pct * 100)}%</Text>
      )}
    </FP_ProgressRing>
  );
};

const styles = StyleSheet.create({
  big: { fontSize: 22, fontWeight: '800', color: FP_COLORS.text },
  sub: { fontSize: 13, color: FP_COLORS.muted },
  pct: { fontSize: 13, fontWeight: '700', color: FP_COLORS.text },
});

export default FP_MealRing;
