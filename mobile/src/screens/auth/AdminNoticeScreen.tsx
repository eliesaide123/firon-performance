/**
 * Admin accounts may only use the web CMS (CONTRACT §3.2), so a valid admin session mounts this
 * instead of a portal: a polite explanation and a way out. Logging out clears the session, which
 * makes `RootNavigator` reset to the guest preview.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  FP_Button,
  FP_Card,
  FP_CmsText,
  FP_Icon,
  FP_Screen,
} from '../../components';
import { useAuth } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import { FP_COLORS } from '../../theme';
import FP_AuthBrand from './components/FP_AuthBrand';

export const AdminNoticeScreen: React.FC = () => {
  const { t } = useContent();
  const { logout, user } = useAuth();
  const [busy, setBusy] = useState(false);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  }, [logout]);

  return (
    <FP_Screen testID="screen-admin-notice">
      <View style={styles.topSpacer} />
      <FP_AuthBrand />

      <FP_Card style={styles.card}>
        <FP_Icon name="warning" size={26} color={FP_COLORS.accent} />
        <FP_CmsText
          k="common.admin_title"
          variant="sectionTitle"
          style={styles.title}
          accessibilityRole="header"
        />
        <FP_CmsText k="common.admin_body" variant="sub" style={styles.body} />
        {user?.email ? (
          <FP_CmsText k="auth.login.identifier_label" variant="tiny" suffix={`: ${user.email}`} style={styles.who} />
        ) : null}
      </FP_Card>

      <FP_Button
        guestAllowed
        testID="admin-logout"
        variant="secondary"
        title={t('profile.cta_logout')}
        loading={busy}
        onPress={() => void signOut()}
        style={styles.logout}
      />
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  topSpacer: { height: 14 },
  card: { marginTop: 28, gap: 10 },
  title: { marginTop: 4 },
  body: { lineHeight: 20 },
  who: { marginTop: 4 },
  logout: { marginTop: 20 },
});

export default AdminNoticeScreen;
