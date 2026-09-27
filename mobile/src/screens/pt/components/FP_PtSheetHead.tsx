import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FP_COLORS, FP_SPACING, FP_TYPE } from '../../../theme';

export interface FP_PtSheetHeadProps {
  /** Already-resolved copy: a client's name, a plan name — data, not UI text. */
  title: string;
  subtitle?: string;
  /** Trailing slot for the prototype's lime "Edit" link. */
  right?: React.ReactNode;
}

/** `<h2>` + `<p class="sub">` at the top of every PT bottom sheet. */
export const FP_PtSheetHead: React.FC<FP_PtSheetHeadProps> = ({ title, subtitle, right }) => (
  <View>
    <View style={styles.row}>
      <Text style={[FP_TYPE.sheetTitle, styles.grow]} numberOfLines={2}>
        {title}
      </Text>
      {right}
    </View>
    {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: FP_SPACING.md },
  grow: { flex: 1 },
  sub: { ...FP_TYPE.sub, color: FP_COLORS.muted, marginTop: FP_SPACING.sm },
});

export default FP_PtSheetHead;
