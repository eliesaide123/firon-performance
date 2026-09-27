/**
 * OTP — the prototype's `otp` screen.
 *
 * 4 boxes with auto-advance and backspace-to-previous (`FP_OtpInput`), the destination shown
 * through `t('auth.otp.subtitle', { dest })`, a resend link, Verify, and the demo-code hint
 * (`1234` is always accepted outside production — CONTRACT §3.6).
 *
 * `purpose: 'verify'` — a successful verify signs the user in, so there is nothing to navigate:
 * the session change makes `RootNavigator` reset onto the right tabs (or Onboarding).
 * `purpose: 'reset'` — the server returns a `resetToken`, which we hand to ResetPassword.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '@firon/shared';
import {
  FP_Button,
  FP_CmsText,
  FP_FieldError,
  FP_OtpInput,
  FP_Row,
  FP_Screen,
  useToast,
} from '../../components';
import { useAuth } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import log from '../../log';
import { FP_COLORS } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import FP_AuthHeader from './components/FP_AuthHeader';
import FP_AuthLink from './components/FP_AuthLink';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

const CODE_LENGTH = 4;

export const OtpScreen: React.FC<Props> = ({ navigation, route }) => {
  const { userId, destination, purpose, channel = 'email', identifier } = route.params;
  const { t } = useContent();
  const { verifyOtp, forgotPassword } = useAuth();
  const { toast } = useToast();

  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (candidate?: string) => {
      const value = candidate ?? code;
      if (value.length < CODE_LENGTH) {
        setInvalid(true);
        setError(t('auth.otp.err_code'));
        return;
      }
      setInvalid(false);
      setError(null);

      setBusy(true);
      try {
        const res = await verifyOtp({
          userId,
          // With no userId (the reset flow) the server looks the account up by identifier.
          destination: userId ? undefined : identifier ?? destination,
          code: value,
          purpose,
        });

        if (purpose === 'reset') {
          if (!res.resetToken) {
            setInvalid(true);
            setError(t('common.error_generic'));
            return;
          }
          navigation.replace('ResetPassword', { resetToken: res.resetToken, identifier });
          return;
        }

        // purpose === 'verify': the user is signed in now. RootNavigator takes it from here.
        toast(t('auth.otp.toast_verified'));
      } catch (err) {
        setInvalid(true);
        setCode('');
        log.info('verify-otp failed', (err as { code?: string }).code);
      } finally {
        setBusy(false);
      }
    },
    [code, userId, identifier, destination, purpose, verifyOtp, navigation, toast, t],
  );

  const resend = useCallback(async () => {
    try {
      if (userId) {
        await api.auth.resendOtp({ userId, purpose, channel });
      } else if (identifier) {
        await forgotPassword({ identifier, channel });
      }
      toast(t('auth.otp.toast_resent'));
    } catch (err) {
      log.info('resend-otp failed', (err as { code?: string }).code);
    }
  }, [userId, identifier, purpose, channel, forgotPassword, toast, t]);

  return (
    <FP_Screen testID="screen-otp">
      <FP_AuthHeader titleKey="auth.otp.title" onBack={() => navigation.goBack()} />

      <FP_CmsText
        k="auth.otp.subtitle"
        vars={{ dest: destination }}
        variant="sub"
        style={styles.subtitle}
      />

      <FP_OtpInput
        testID="otp-input"
        value={code}
        length={CODE_LENGTH}
        invalid={invalid}
        onChange={value => {
          setCode(value);
          if (invalid) {
            setInvalid(false);
            setError(null);
          }
        }}
        onComplete={value => void submit(value)}
        style={styles.otp}
      />
      <FP_FieldError message={error ?? ''} visible={Boolean(error)} />

      <FP_Row between align="center" style={styles.resendRow}>
        <FP_CmsText k="auth.otp.resend_q" style={styles.resendQ} />
        <FP_AuthLink k="auth.otp.resend" onPress={() => void resend()} />
      </FP_Row>

      <FP_Button
        guestAllowed
        testID="otp-submit"
        title={t('auth.otp.submit')}
        loading={busy}
        onPress={() => void submit()}
        style={styles.submit}
      />

      <FP_CmsText k="auth.otp.demo_hint" variant="tiny" style={styles.hint} />
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  subtitle: { marginTop: 8 },
  otp: { marginTop: 20 },
  resendRow: { marginTop: 16 },
  resendQ: { fontSize: 13, color: FP_COLORS.muted },
  submit: { marginTop: 20 },
  hint: { textAlign: 'center', marginTop: 12 },
});

export default OtpScreen;
