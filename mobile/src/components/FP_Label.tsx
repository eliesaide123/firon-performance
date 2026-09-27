import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { FP_TYPE } from '../theme';

export interface FP_LabelProps {
  children: React.ReactNode;
  /** the bolder 12.5px section label the prototype uses above chip groups */
  section?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** A field label or a small section label. */
export const FP_Label: React.FC<FP_LabelProps> = ({ children, section, style, numberOfLines }) => (
  <Text style={[FP_TYPE.label, section && styles.section, style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);

const styles = StyleSheet.create({
  section: { fontWeight: '700' },
});

export default FP_Label;
