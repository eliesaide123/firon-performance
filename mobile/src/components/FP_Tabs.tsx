import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import FP_Chip from './FP_Chip';
import FP_ChipScroll from './FP_ChipScroll';

export interface FP_TabsProps<T extends string> {
  /** Opt out of the guest gate (auth screens, the guest banner CTA, alert/toast controls). */
  guestAllowed?: boolean;
  tabs: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * In-page tabs. The prototype renders these as a chip rail (Train's
 * "This week / Program / History", Videos' categories), so that is what this is.
 */
export function FP_Tabs<T extends string>({
  tabs,
  value,
  onChange,
  style,
  guestAllowed,
}: FP_TabsProps<T>): React.ReactElement {
  return (
    <FP_ChipScroll style={style}>
      {tabs.map(tab => (
        <FP_Chip
          key={tab.key}
          label={tab.label}
          active={tab.key === value}
          onPress={() => onChange(tab.key)}
          guestAllowed={guestAllowed}
        />
      ))}
    </FP_ChipScroll>
  );
}

export default FP_Tabs;
