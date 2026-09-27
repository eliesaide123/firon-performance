import React from 'react';
import { ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { FP_COLORS } from '../theme';

export interface FP_SpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export const FP_Spinner: React.FC<FP_SpinnerProps> = ({
  size = 'small',
  color = FP_COLORS.accent,
  style,
}) => <ActivityIndicator size={size} color={color} style={style} />;

export default FP_Spinner;
