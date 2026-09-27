import React from 'react';
import { StyleProp, Switch, ViewStyle } from 'react-native';
import { FP_COLORS } from '../theme';
import { useGatedPress } from '../guest/GuestGateProvider';

export interface FP_SwitchProps {
  /** Opt out of the guest gate (auth screens, the guest banner CTA, alert/toast controls). */
  guestAllowed?: boolean;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Platform switch, themed lime. */
export const FP_Switch: React.FC<FP_SwitchProps> = ({
  value,
  onValueChange,
  disabled,
  style,
  accessibilityLabel,
  guestAllowed,
}) => {
  const handleChange = useGatedPress(onValueChange, guestAllowed);
  return (
  <Switch
    value={value}
    onValueChange={handleChange}
    disabled={disabled}
    style={style}
    accessibilityLabel={accessibilityLabel}
    trackColor={{ false: FP_COLORS.surface3, true: FP_COLORS.accent }}
    thumbColor={FP_COLORS.text}
    ios_backgroundColor={FP_COLORS.surface3}
    />
  );
};

export default FP_Switch;
