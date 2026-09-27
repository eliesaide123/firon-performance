/**
 * Login (CONTRACT §3.1 — HARD REQUIREMENT).
 *
 * **There is deliberately no client/trainer selector.** The prototype had an "I am a…" role
 * picker with two cards; it is removed on purpose. The server looks the user up and returns
 * `user.role`, and `RootNavigator` resets onto the tabs for that role. Do not re-add it.
 *
 * Everything else follows the prototype: brand row, "Welcome back", email-or-phone, password
 * with a show/hide toggle, Remember me, Forgot password?, Sign in, "New here? Create account".
 *
 * Error handling: `api.auth.login` suppresses the popup for VALIDATION_ERROR,
 * INVALID_CREDENTIALS, ACCOUNT_DISABLED and NOT_VERIFIED (§11.1), so this screen renders those
 * inline under the password field — and on NOT_VERIFIED jumps to Otp with the id the server
 * put in `err.details`.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FPError } from '@firon/shared';
import {
  FP_Button,
  FP_Checkbox,
  FP_CmsText,
  FP_Row,
  FP_Screen,
  FP_Textbox,
} from '../../components';
import { useAuth } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import log from '../../log';
import { FP_COLORS } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import FP_AuthBrand from './components/FP_AuthBrand';
import FP_AuthLink from './components/FP_AuthLink';
import { isIdentifier, isPassword } from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

/** `details` on a NOT_VERIFIED 403 (backend auth.controller). */
interface NotVerifiedDetails {
  userId?: string;
  destination?: string;
}

export const LoginScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useContent();
  const { login, rememberedIdentifier, remember: rememberedFlag } = useAuth();

  const [identifier, setIdentifier] = useState(route.params?.identifier ?? rememberedIdentifier);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(rememberedFlag);
  const [busy, setBusy] = useState(false);
  /** Local validation flags — `null` until the field has been submitted once. */
  const [idError, setIdError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const trimmed = useMemo(() => identifier.trim(), [identifier]);

  const submit = useCallback(async () => {
    // Prototype's `doLogin()`: email OR phone, password >= 6, red border + `.err-msg`.
    const badId = !isIdentifier(trimmed);
    const badPw = !isPassword(password);
    setIdError(badId ? t('auth.login.err_identifier') : null);
    setPwError(badPw ? t('auth.login.err_password') : null);
    if (badId || badPw) {
      return;
    }

    setBusy(true);
    try {
      await login({ identifier: trimmed, password, remember });
      // Nothing to do on success: the session change makes RootNavigator reset onto the tabs
      // for the role the server returned. Never goBack() — a trainer would land in the client
      // tabs (CONTRACT §13.1).
    } catch (err) {
      const fp = err as FPError;
      if (fp?.code === 'NOT_VERIFIED') {
        const details = (fp.details ?? {}) as NotVerifiedDetails;
        navigation.navigate('Otp', {
          userId: details.userId,
          destination: details.destination ?? trimmed,
          purpose: 'verify',
          channel: 'email',
          identifier: trimmed,
        });
        return;
      }
      // VALIDATION_ERROR / INVALID_CREDENTIALS / ACCOUNT_DISABLED never pop a dialog, so they
      // have to be shown here. The server's copy is already user-facing
      // ("Wrong email/phone or password").
      const fieldMessage = fp?.fieldErrors?.identifier;
      if (fieldMessage) {
        setIdError(fieldMessage);
        setPwError(fp.fieldErrors?.password ?? null);
      } else {
        setPwError(fp?.message ?? t('common.error_generic'));
      }
      log.info('login failed', fp?.code);
    } finally {
      setBusy(false);
    }
  }, [trimmed, password, remember, login, navigation, t]);

  return (
    <FP_Screen testID="screen-login">
      <View style={styles.topSpacer} />
      <FP_AuthBrand />

      <View style={styles.titleBlock}>
        <FP_CmsText k="auth.login.title" variant="screenTitle" accessibilityRole="header" />
        <FP_CmsText k="auth.login.subtitle" variant="sub" style={styles.subtitle} />
      </View>

      {/* NO ROLE PICKER HERE — CONTRACT §3.1. */}

      <FP_Textbox
        guestAllowed
        testID="login-identifier"
        label={t('auth.login.identifier_label')}
        placeholder={t('auth.login.identifier_ph')}
        value={identifier}
        onChangeText={value => {
          setIdentifier(value);
          if (idError) setIdError(null);
        }}
        error={idError}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        containerStyle={styles.field}
      />

      <FP_Textbox
        guestAllowed
        secure
        testID="login-password"
        label={t('auth.login.password_label')}
        placeholder={t('auth.login.password_ph')}
        value={password}
        onChangeText={value => {
          setPassword(value);
          if (pwError) setPwError(null);
        }}
        error={pwError}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        containerStyle={styles.field}
      />

      <FP_Row between align="center" gap={12} style={styles.rememberRow}>
        <FP_Row gap={8} align="center">
          <FP_Checkbox
            guestAllowed
            checked={remember}
            onPress={() => setRemember(value => !value)}
            accessibilityLabel={t('auth.login.remember')}
            testID="login-remember"
          />
          <FP_CmsText k="auth.login.remember" style={styles.rememberLabel} />
        </FP_Row>
        <FP_AuthLink k="auth.login.forgot" onPress={() => navigation.navigate('Forgot')} />
      </FP_Row>

      <FP_Button
        guestAllowed
        testID="login-submit"
        title={t('auth.login.submit')}
        loading={busy}
        onPress={() => void submit()}
        style={styles.submit}
      />

      <FP_Row gap={6} align="center" style={styles.footer}>
        <FP_CmsText k="auth.login.new_here" style={styles.footerText} />
        <FP_AuthLink
          k="auth.login.create_account"
          onPress={() => navigation.navigate('Register')}
          style={styles.footerLink}
        />
      </FP_Row>
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  topSpacer: { height: 14 },
  titleBlock: { marginTop: 24 },
  subtitle: { marginTop: 8 },
  field: { marginTop: 16 },
  rememberRow: { marginTop: 12 },
  rememberLabel: { fontSize: 13, color: FP_COLORS.muted },
  submit: { marginTop: 20 },
  footer: { justifyContent: 'center', marginTop: 16 },
  footerText: { fontSize: 13.5, color: FP_COLORS.muted },
  footerLink: { fontSize: 13.5, fontWeight: '700' },
});

export default LoginScreen;
