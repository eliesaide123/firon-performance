import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FP_CmsText } from '../../../components';
import { fpAdherenceColor } from '../../../theme';

export interface FP_PtAdherenceProps {
  /** 0–100. Coloured with the prototype's thresholds (≥80 lime, ≥70 amber, else red). */
  pct: number;
}

/** The roster card's right-hand block: big coloured percentage over an "adherence" caption. */
export const FP_PtAdherence: React.FC<FP_PtAdherenceProps> = ({ pct }) => (
  <View style={styles.wrap}>
    <Text style={[styles.value, { color: fpAdherenceColor(pct) }]}>{`${Math.round(pct)}%`}</Text>
    <FP_CmsText k="pt.roster.adherence_label" style={styles.caption} />
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end' },
  value: { fontWeight: '800', fontSize: 15 },
  caption: { fontSize: 10 },
});

export default FP_PtAdherence;
