/**
 * The prototype's `.apphead` for the auth stack: an optional `‹` back button and the
 * 22px screen title, with the subtitle underneath.
 *
 * Lives inside `screens/auth/` rather than `src/components/` so it cannot collide with the
 * shared FP_ library another agent owns (still FP_-prefixed, per CONTRACT §12).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  FP_AppHeader,
  FP_CmsText,
  FP_Icon,
  FP_IconButton,
} from '../../../components';
import type { TVars } from '../../../cms/ContentProvider';
import { FP_COLORS } from '../../../theme';

export interface FP_AuthHeaderProps {
  /** CMS key for the 22px title, e.g. `auth.register.title`. */
  titleKey: string;
  /** CMS key for the muted line beneath it. */
  subtitleKey?: string;
  subtitleVars?: TVars;
  /** Omitted on the Login screen, which is the root of the flow. */
  onBack?: () => void;
}

export const FP_AuthHeader: React.FC<FP_AuthHeaderProps> = ({
  titleKey,
  subtitleKey,
  subtitleVars,
  onBack,
}) => (
  <View>
    <FP_AppHeader
      left={
        onBack ? (
          <FP_IconButton
            guestAllowed
            onPress={onBack}
            accessibilityLabel="Back"
            testID="auth-back"
          >
            <FP_Icon name="chevron-left" size={20} color={FP_COLORS.text} />
          </FP_IconButton>
        ) : undefined
      }
    >
      <View style={styles.grow}>
        <FP_CmsText k={titleKey} style={styles.title} accessibilityRole="header" />
      </View>
    </FP_AppHeader>
    {subtitleKey ? (
      <FP_CmsText k={subtitleKey} vars={subtitleVars} variant="sub" style={styles.subtitle} />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  grow: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, color: FP_COLORS.text },
  subtitle: { marginTop: 8, lineHeight: 19 },
});

export default FP_AuthHeader;
