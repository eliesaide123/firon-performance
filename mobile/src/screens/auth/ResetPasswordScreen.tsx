/**
 * Choose a new password, after a `purpose: 'reset'` OTP handed us a `resetToken`.
 *
 * New password + confirm, both at least 6 characters (CONTRACT §3.5), then back to a
 * pre-filled Login with a success toast. The user is not signed in by this flow — resetting a
 * password deliberately does not mint a session.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FP_Button, FP_Screen, FP_Textbox, useToast } from '../../components';
import { useAuth } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import log from '../../log';
import type { RootStackParamList } from '../../navigation/types';
import FP_AuthHeader from './components/FP_AuthHeader';
import { isPassword } from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const { resetToken, identifier } = route.params;
  const { t } = useContent();
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    const badPw = !isPassword(password);
    const mismatch = !badPw && password !== confirm;
    setPwError(badPw ? t('auth.login.err_password') : null);
    setConfirmError(mismatch ? t('auth.forgot.err_confirm') : null);
    if (badPw || mismatch) {
      return;
    }

    setBusy(true);
    try {
      await resetPassword({ resetToken, password });
      toast(t('auth.forgot.reset_done'));
      // Straight back to the guest preview with the Login modal on top, pre-filled.
      navigation.reset({
        index: 1,
        routes: [{ name: 'ClientTabs' }, { name: 'Login', params: { identifier } }],
      });
    } catch (err) {
      log.info('reset-password failed', (err as { code?: string }).code);
    } finally {
      setBusy(false);
    }
  }, [password, confirm, resetToken, identifier, resetPassword, navigation, toast, t]);

  return (
    <FP_Screen testID="screen-reset-password">
      {/* No subtitle: `auth.forgot.subtitle` belongs to the identifier step, and there is no
          CMS key for this one — the title says everything it needs to. */}
      <FP_AuthHeader titleKey="auth.forgot.reset_title" onBack={() => navigation.goBack()} />

      <FP_Textbox
        guestAllowed
        secure
        testID="reset-password"
        label={t('auth.forgot.reset_label')}
        placeholder={t('auth.register.password_ph')}
        value={password}
        onChangeText={value => {
          setPassword(value);
          if (pwError) setPwError(null);
        }}
        error={pwError}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        returnKeyType="next"
        containerStyle={styles.field}
      />

      <FP_Textbox
        guestAllowed
        secure
        testID="reset-confirm"
        label={t('auth.forgot.confirm_label')}
        placeholder={t('auth.register.password_ph')}
        value={confirm}
        onChangeText={value => {
          setConfirm(value);
          if (confirmError) setConfirmError(null);
        }}
        error={confirmError}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        containerStyle={styles.field}
      />

      <FP_Button
        guestAllowed
        testID="reset-submit"
        title={t('auth.forgot.reset_submit')}
        loading={busy}
        onPress={() => void submit()}
        style={styles.submit}
      />
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  field: { marginTop: 16 },
  submit: { marginTop: 20 },
});

export default ResetPasswordScreen;
