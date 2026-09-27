import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { FP_CmsText, FP_Row } from '../../../components';
import { FP_SPACING } from '../../../theme';
import FP_PtTextButton from './FP_PtTextButton';

export interface FP_PtSectionHeadProps {
  /** CMS key for the heading — never a literal. */
  k: string;
  /** CMS key for the trailing text action (the prototype's lime "Edit" link). */
  actionKey?: string;
  onAction?: () => void;
  /** 15px like the prototype's card headings; 17px for the screen-level ones. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The prototype's `<div class="row between"><h2>…</h2><a class="accent">Edit</a></div>`
 * section heading, used by the PT profile and builder screens.
 */
export const FP_PtSectionHead: React.FC<FP_PtSectionHeadProps> = ({
  k,
  actionKey,
  onAction,
  large,
  style,
}) => (
  <FP_Row between style={[styles.head, style]}>
    <FP_CmsText k={k} variant={large ? 'sectionTitle' : undefined} style={large ? undefined : styles.small} />
    {actionKey && onAction ? <FP_PtTextButton k={actionKey} onPress={onAction} /> : null}
  </FP_Row>
);

const styles = StyleSheet.create({
  head: { marginTop: FP_SPACING.xl },
  small: { fontSize: 15, fontWeight: '800' },
});

export default FP_PtSectionHead;
