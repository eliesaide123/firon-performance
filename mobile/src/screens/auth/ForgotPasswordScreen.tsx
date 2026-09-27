/**
 * Forgot password — the prototype's `forgot` screen.
 *
 * Identifier + an email/SMS segmented control, "Send code" → `forgotPassword()` → the OTP
 * screen with `purpose: 'reset'`.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OtpChannel } from '@firon/shared';
import {
  FP_Button,
  FP_Screen,
  FP_Segmented,
  FP_Textbox,
} from '../../components';
import { useAuth } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import log from '../../log';
import type { RootStackParamList } from '../../navigation/types';
import FP_AuthHeader from './components/FP_AuthHeader';
import { isIdentifier } from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'Forgot'>;

const CHANNELS: readonly OtpChannel[] = ['email', 'sms'];

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useContent();
  const { forgotPassword } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('email');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    // Prototype's `doForgot()`: email OR phone, nothing else.
    const trimmed = identifier.trim();
    if (!isIdentifier(trimmed)) {
      setError(t('auth.forgot.err_identifier'));
      return;
    }
    setError(null);

    setBusy(true);
    try {
      const destination = await forgotPassword({ identifier: trimmed, channel });
      navigation.replace('Otp', {
        destination,
        purpose: 'reset',
        channel,
        // The raw identifier is what `verify-otp` looks the user up by when there is no userId.
        identifier: trimmed,
      });
    } catch (err) {
      log.info('forgot-password failed', (err as { code?: string }).code);
    } finally {
      setBusy(false);
    }
  }, [identifier, channel, forgotPassword, navigation, t]);

  return (
    <FP_Screen testID="screen-forgot">
      <FP_AuthHeader
        titleKey="auth.forgot.title"
        subtitleKey="auth.forgot.subtitle"
        onBack={() => navigation.goBack()}
      />

      <FP_Textbox
        guestAllowed
        testID="forgot-identifier"
        label={t('auth.login.identifier_label')}
        placeholder={t('auth.login.identifier_ph')}
        value={identifier}
        onChangeText={value => {
          setIdentifier(value);
          if (error) setError(null);
        }}
        error={error}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        containerStyle={styles.field}
      />

      <FP_Segmented
        guestAllowed
        testID="forgot-channel"
        options={CHANNELS}
        value={channel}
        onChange={setChannel}
        labelFor={option => t(option === 'email' ? 'auth.forgot.via_email' : 'auth.forgot.via_sms')}
        style={styles.segmented}
      />

      <FP_Button
        guestAllowed
        testID="forgot-submit"
        title={t('auth.forgot.submit')}
        loading={busy}
        onPress={() => void submit()}
        style={styles.submit}
      />
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  field: { marginTop: 16 },
  segmented: { marginTop: 16 },
  submit: { marginTop: 20 },
});

export default ForgotPasswordScreen;
