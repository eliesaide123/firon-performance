/**
 * CMS-driven text. **This is how every user-visible string reaches the screen.**
 *
 *   <FP_CmsText k="home.suggested_title" style={styles.sectionTitle} />
 *   <FP_CmsText k="home.suggested_sub" vars={{ coach: coachFirstName }} />
 *
 * The value comes from the `Content` collection via ContentProvider, which patches itself live
 * on the `content:updated` socket event — so an admin editing a label in the CMS changes this
 * text without an app restart. Falls back to the compiled defaults offline.
 *
 * No screen may hardcode a user-visible string (CONTRACT §8).
 */
import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { FP_COLORS, FP_TYPE } from '../theme';
import { useContent, type TVars } from '../cms/ContentProvider';

export interface FP_CmsTextProps {
  /** The content key, e.g. `auth.login.title`. */
  k: string;
  /** Interpolations for `{coach}`, `{dest}`, `{first}`, `{plan}`, `{when}`. */
  vars?: TVars;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Preset typography ramps so screens don't re-declare font sizes. */
  variant?: 'screenTitle' | 'sectionTitle' | 'body' | 'sub' | 'label' | 'tiny';
  /** Uppercase the resolved value (badge copy). */
  uppercase?: boolean;
  /** Appended after the resolved value, e.g. a separator. */
  suffix?: string;
  testID?: string;
  accessibilityRole?: 'header' | 'text';
}

const VARIANTS: Record<NonNullable<FP_CmsTextProps['variant']>, TextStyle> = {
  screenTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, color: FP_COLORS.text },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: FP_COLORS.text },
  body: { fontSize: 15, color: FP_COLORS.text },
  sub: { fontSize: 13, color: FP_COLORS.muted },
  label: { fontSize: 12.5, fontWeight: '600', color: FP_COLORS.muted },
  tiny: { fontSize: 11, color: FP_COLORS.muted },
};

export const FP_CmsText: React.FC<FP_CmsTextProps> = ({
  k,
  vars,
  style,
  numberOfLines,
  variant,
  uppercase,
  suffix,
  testID,
  accessibilityRole,
}) => {
  const { t } = useContent();
  let value = t(k, vars);
  if (uppercase) value = value.toUpperCase();
  if (suffix) value = `${value}${suffix}`;

  return (
    <Text
      testID={testID ?? `cms:${k}`}
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      style={[{ color: FP_COLORS.text, fontSize: FP_TYPE?.body?.fontSize ?? 15 }, variant && VARIANTS[variant], style]}
    >
      {value}
    </Text>
  );
};

export default FP_CmsText;
