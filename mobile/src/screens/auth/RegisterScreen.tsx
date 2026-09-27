/**
 * Register — the prototype's `register` screen.
 *
 * Full name / email / phone / password with the prototype's validation, then
 * `register()` → the OTP screen with `{ userId, destination, purpose: 'verify' }`.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  FP_Button,
  FP_CmsText,
  FP_Screen,
  FP_Textbox,
} from '../../components';
import { useAuth } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import log from '../../log';
import type { RootStackParamList } from '../../navigation/types';
import FP_AuthHeader from './components/FP_AuthHeader';
import { isEmail, isPassword, isPhone } from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

interface Errors {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  password?: string | null;
}

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useContent();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const clear = useCallback((field: keyof Errors) => {
    setErrors(prev => (prev[field] ? { ...prev, [field]: null } : prev));
  }, []);

  const submit = useCallback(async () => {
    // Prototype's `doRegister()`.
    const next: Errors = {
      name: name.trim() ? null : t('auth.register.err_name'),
      email: isEmail(email.trim()) ? null : t('auth.register.err_email'),
      phone: isPhone(phone.trim()) ? null : t('auth.register.err_phone'),
      password: isPassword(password) ? null : t('auth.register.err_password'),
    };
    setErrors(next);
    if (next.name || next.email || next.phone || next.password) {
      return;
    }

    setBusy(true);
    try {
      const res = await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
      navigation.replace('Otp', {
        userId: res.userId,
        destination: res.destination || email.trim(),
        purpose: 'verify',
        channel: 'email',
        identifier: email.trim(),
      });
    } catch (err) {
      // `api.auth.register` pops its own alert for everything except field errors, which the
      // proxy hands back as `fieldErrors` (CONTRACT §11.1).
      const fieldErrors = (err as { fieldErrors?: Record<string, string> }).fieldErrors;
      if (fieldErrors) {
        setErrors({
          name: fieldErrors.name ?? null,
          email: fieldErrors.email ?? null,
          phone: fieldErrors.phone ?? null,
          password: fieldErrors.password ?? null,
        });
      }
      log.info('register failed', (err as { code?: string }).code);
    } finally {
      setBusy(false);
    }
  }, [name, email, phone, password, register, navigation, t]);

  return (
    <FP_Screen testID="screen-register">
      <FP_AuthHeader
        titleKey="auth.register.title"
        subtitleKey="auth.register.subtitle"
        onBack={() => navigation.goBack()}
      />

      <FP_Textbox
        guestAllowed
        testID="register-name"
        label={t('auth.register.name_label')}
        placeholder={t('auth.register.name_ph')}
        value={name}
        onChangeText={value => {
          setName(value);
          clear('name');
        }}
        error={errors.name}
        autoCapitalize="words"
        textContentType="name"
        returnKeyType="next"
        containerStyle={styles.field}
      />

      <FP_Textbox
        guestAllowed
        testID="register-email"
        label={t('auth.register.email_label')}
        placeholder={t('auth.register.email_ph')}
        value={email}
        onChangeText={value => {
          setEmail(value);
          clear('email');
        }}
        error={errors.email}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        containerStyle={styles.field}
      />

      <FP_Textbox
        guestAllowed
        testID="register-phone"
        label={t('auth.register.phone_label')}
        placeholder={t('auth.register.phone_ph')}
        value={phone}
        onChangeText={value => {
          setPhone(value);
          clear('phone');
        }}
        error={errors.phone}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        returnKeyType="next"
        containerStyle={styles.field}
      />

      <FP_Textbox
        guestAllowed
        secure
        testID="register-password"
        label={t('auth.register.password_label')}
        placeholder={t('auth.register.password_ph')}
        value={password}
        onChangeText={value => {
          setPassword(value);
          clear('password');
        }}
        error={errors.password}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        containerStyle={styles.field}
      />

      <FP_Button
        guestAllowed
        testID="register-submit"
        title={t('auth.register.submit')}
        loading={busy}
        onPress={() => void submit()}
        style={styles.submit}
      />

      <FP_CmsText k="auth.register.otp_hint" variant="tiny" style={styles.hint} />
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  field: { marginTop: 16 },
  submit: { marginTop: 20 },
  hint: { textAlign: 'center', marginTop: 14 },
});

export default RegisterScreen;
