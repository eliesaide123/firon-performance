/**
 * Home's today's-session card — the prototype's
 * `background:linear-gradient(135deg,#1f3a24,#122a2f); border-color:#2c4a34` panel with the
 * `TODAY'S SESSION` pill, the time on the right, the session title, the coach/studio/duration line
 * and the "Start workout" button.
 *
 * When the CMS has an image on `home.today_banner` it paints behind the gradient scrim, so the
 * card can be re-skinned without an app release.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { FP_Badge, FP_Button, FP_Card, FP_CmsImage } from '../../../components';
import { useContent } from '../../../cms/ContentProvider';
import {
  FP_COLORS,
  FP_EXTRA_COLORS,
  FP_GRADIENT_DIRECTION,
  FP_RADIUS,
  FP_SPACING,
  FP_TYPE,
} from '../../../theme';

const BANNER_KEY = 'home.today_banner';

export interface FP_TodayCardProps {
  badgeLabel: string;
  /** right-hand meta on the badge row (session time, or the plan day label) */
  metaLabel?: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export const FP_TodayCard: React.FC<FP_TodayCardProps> = ({
  badgeLabel,
  metaLabel,
  title,
  subtitle,
  ctaLabel,
  onPressCta,
}) => {
  const { media } = useContent();
  const hasBanner = Boolean(media(BANNER_KEY));

  return (
    <FP_Card style={styles.card}>
      {hasBanner ? (
        <FP_CmsImage k={BANNER_KEY} style={StyleSheet.absoluteFill} radius={FP_RADIUS.card} />
      ) : null}
      <LinearGradient
        colors={
          hasBanner
            ? [FP_EXTRA_COLORS.transparent, FP_EXTRA_COLORS.scrimTop]
            : [FP_EXTRA_COLORS.todayFrom, FP_EXTRA_COLORS.todayTo]
        }
        start={FP_GRADIENT_DIRECTION.start}
        end={FP_GRADIENT_DIRECTION.end}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <FP_Badge label={badgeLabel} tone="pt" />
          {metaLabel ? <Text style={FP_TYPE.sub}>{metaLabel}</Text> : null}
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        {ctaLabel && onPressCta ? (
          <FP_Button title={ctaLabel} compact onPress={onPressCta} style={styles.cta} />
        ) : null}
      </View>
    </FP_Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderColor: FP_EXTRA_COLORS.todayBorder,
    backgroundColor: FP_EXTRA_COLORS.todayFrom,
    overflow: 'hidden',
  },
  content: { position: 'relative' },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: FP_SPACING.md,
  },
  title: { ...FP_TYPE.cardTitle, marginTop: 10 },
  sub: { ...FP_TYPE.sub, color: FP_COLORS.muted, marginTop: FP_SPACING.sm },
  cta: { marginTop: FP_SPACING.lg },
});

export default FP_TodayCard;
