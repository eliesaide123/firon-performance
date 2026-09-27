/** The prototype's centred coach card at the top of `pt-profile`. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FP_Avatar, FP_Badge, FP_Card } from '../../../components';
import { FP_COLORS, FP_SPACING, FP_TYPE } from '../../../theme';

export interface FP_PtIdentityCardProps {
  /** Server data, not UI copy. */
  name: string;
  title?: string;
  contact?: string;
  /** CMS-resolved "Trainer · Verified". */
  badgeLabel: string;
}

export const FP_PtIdentityCard: React.FC<FP_PtIdentityCardProps> = ({
  name,
  title,
  contact,
  badgeLabel,
}) => (
  <FP_Card style={styles.card}>
    <FP_Avatar name={name} size={88} />
    <Text style={styles.name}>{name}</Text>
    {title ? <Text style={styles.sub}>{title}</Text> : null}
    {contact ? <Text style={styles.contact}>{contact}</Text> : null}
    <View style={styles.badge}>
      <FP_Badge tone="pt" label={badgeLabel} />
    </View>
  </FP_Card>
);

const styles = StyleSheet.create({
  card: { marginTop: FP_SPACING.md, alignItems: 'center' },
  name: { ...FP_TYPE.screenTitle, fontSize: 20, marginTop: FP_SPACING.md, textAlign: 'center' },
  sub: { ...FP_TYPE.sub, color: FP_COLORS.muted, textAlign: 'center' },
  contact: { ...FP_TYPE.sub, color: FP_COLORS.muted, marginTop: FP_SPACING.sm, textAlign: 'center' },
  badge: { marginTop: 10 },
});

export default FP_PtIdentityCard;
