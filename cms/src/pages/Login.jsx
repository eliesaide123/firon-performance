/*
 * CMS sign-in (CONTRACT §3).
 *
 * There is NO role selector anywhere on this screen — just email-or-phone and
 * password. The server returns the role; non-staff roles are refused with the
 * staff-only message and never get a session.
 *
 * `api.auth.login` suppresses the alert popup for the codes a login form should
 * render itself (VALIDATION_ERROR, INVALID_CREDENTIALS, NOT_VERIFIED,
 * ACCOUNT_DISABLED), so those appear inline. Everything else pops via
 * FP_AlertProvider and we do not catch it.
 */
import { ArrowLeft, LogIn, Lock, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, isFPError } from '@firon/shared';
import { useAuth, STAFF_ONLY_MESSAGE } from '../context/AuthContext.jsx';
import { APP_VERSION } from '../lib/constants.js';
import { HOME_FOR_ROLE } from '../lib/navItems.js';
import {
  FP_Button, FP_Card, FP_Checkbox, FP_IconButton, FP_OtpInput, FP_Row,
  FP_Segmented, FP_Textbox, useToast,
} from '../components/index.ts';

const looksLikeIdentifier = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\+?[\d\s()-]{6,}$/.test(v);

/** Codes the form renders inline rather than letting the popup handle. */
const INLINE_CODES = ['VALIDATION_ERROR', 'INVALID_CREDENTIALS', 'NOT_VERIFIED', 'ACCOUNT_DISABLED', 'STAFF_ONLY'];

export default function Login() {
  const { login, user, loading, bootError, clearBootError } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();

  const [mode, setMode] = useState('login'); // login | forgot | otp | reset
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [channel, setChannel] = useState('email');
  const [code, setCode] = useState(['', '', '', '']);
  const [resetToken, setResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpDest, setOtpDest] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(bootError ?? null);
  const [busy, setBusy] = useState(false);

  const next = params.get('next') || '';

  useEffect(() => {
    if (user && !loading) {
      navigate(next || HOME_FOR_ROLE[user.role] || '/', { replace: true });
    }
  }, [user, loading, navigate, next]);

  useEffect(() => {
    if (bootError) { setFormError(bootError); clearBootError(); }
  }, [bootError, clearBootError]);

  const resetErrors = () => { setFieldErrors({}); setFormError(null); };

  /** Turn an FPError into inline messages; rethrow anything unexpected. */
  const renderInline = (err) => {
    if (err?.code === 'STAFF_ONLY') { setFormError(STAFF_ONLY_MESSAGE); return; }
    if (isFPError(err) && err.fieldErrors) {
      setFieldErrors({
        identifier: err.fieldErrors.identifier,
        password: err.fieldErrors.password,
      });
    }
    if (isFPError(err) && INLINE_CODES.includes(String(err.code))) { setFormError(err.message); return; }
    // Anything else already produced an FP_Alert popup; show the gist too.
    setFormError(err?.message ?? 'Sign-in failed');
  };

  /* ------------------------------- sign in ------------------------------- */
  const submitLogin = async (e) => {
    e.preventDefault();
    resetErrors();
    const errors = {};
    if (!looksLikeIdentifier(identifier.trim())) errors.identifier = 'Enter a valid email or phone number';
    if (password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }

    setBusy(true);
    try {
      const profile = await login(identifier.trim(), password, remember);
      toast.success(`Welcome back, ${profile.name?.split(' ')[0] ?? 'there'}`);
      navigate(next || HOME_FOR_ROLE[profile.role] || '/', { replace: true });
    } catch (err) {
      renderInline(err);
    } finally {
      setBusy(false);
    }
  };

  /* ----------------------------- forgot / OTP ---------------------------- */
  const submitForgot = async (e) => {
    e.preventDefault();
    resetErrors();
    if (!looksLikeIdentifier(identifier.trim())) {
      setFieldErrors({ identifier: 'Enter a valid email or phone' });
      return;
    }
    setBusy(true);
    try {
      const data = await api.auth.forgotPassword({ identifier: identifier.trim(), channel });
      setOtpDest(data?.destination ?? identifier.trim());
      setCode(['', '', '', '']);
      setMode('otp');
      toast.success('Verification code sent', { sub: data?.destination ?? identifier.trim() });
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    resetErrors();
    const joined = code.join('');
    if (joined.length !== 4) { setFormError('Enter the 4-digit code'); return; }
    setBusy(true);
    try {
      const data = await api.auth.verifyOtp({
        destination: otpDest || identifier.trim(),
        code: joined,
        purpose: 'reset',
      });
      if (!data?.resetToken) { setFormError('The server did not return a reset token'); return; }
      setResetToken(data.resetToken);
      setMode('reset');
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    await api.auth.forgotPassword(
      { identifier: otpDest || identifier.trim(), channel },
      { successMessage: 'Code resent' },
    );
  };

  const submitReset = async (e) => {
    e.preventDefault();
    resetErrors();
    if (newPassword.length < 6) { setFieldErrors({ newPassword: 'Password must be at least 6 characters' }); return; }
    if (newPassword !== confirmPassword) { setFieldErrors({ confirmPassword: 'Passwords do not match' }); return; }
    setBusy(true);
    try {
      await api.auth.resetPassword({ resetToken, password: newPassword });
      toast.success('Password updated — sign in with your new password');
      setPassword('');
      setMode('login');
    } finally {
      setBusy(false);
    }
  };

  const backToLogin = () => { resetErrors(); setMode('login'); };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <span className="sidebar__mark login__mark">◈</span>
          <div>
            <div className="login__wordmark">Firon Performance</div>
            <div className="small muted">Train. Track. Transform.</div>
          </div>
        </div>

        <FP_Card>
          {mode === 'login' ? (
            <form onSubmit={submitLogin} noValidate>
              <h1 className="login__title">Welcome back</h1>
              <p className="login__sub">Sign in with your email or phone</p>

              <div className="mt4 col">
                <FP_Textbox
                  label="Email or phone"
                  placeholder="you@email.com"
                  autoComplete="username"
                  leftIcon={Mail}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  error={fieldErrors.identifier}
                  large
                  autoFocus
                />
                <FP_Textbox
                  label="Password"
                  secure
                  placeholder="••••••••"
                  autoComplete="current-password"
                  leftIcon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={fieldErrors.password}
                  large
                />
              </div>

              <FP_Row between className="mt3">
                <FP_Checkbox checked={remember} onChange={setRemember} label="Remember me" />
                <FP_Button variant="ghost" size="sm" onPress={() => { resetErrors(); setMode('forgot'); }}>
                  Forgot password?
                </FP_Button>
              </FP_Row>

              {formError ? <div className="errorbox mt3" role="alert">{formError}</div> : null}

              <FP_Button type="submit" fullWidth size="lg" className="mt4" loading={busy} icon={LogIn}>
                Sign in
              </FP_Button>
              <div className="login__foot">Staff portal · admins and trainers only</div>
            </form>
          ) : null}

          {mode === 'forgot' ? (
            <form onSubmit={submitForgot} noValidate>
              <FP_IconButton small icon={ArrowLeft} label="Back to sign in" onPress={backToLogin} />
              <h1 className="login__title mt3">Reset password</h1>
              <p className="login__sub">
                Enter your email or phone and we&apos;ll send a one-time verification code.
              </p>
              <div className="mt4">
                <FP_Textbox
                  label="Email or phone"
                  placeholder="you@email.com"
                  leftIcon={Mail}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  error={fieldErrors.identifier}
                  large
                  autoFocus
                />
              </div>
              <div className="mt3">
                <FP_Segmented
                  fullWidth
                  value={channel}
                  onChange={setChannel}
                  options={[
                    { value: 'email', label: 'Send via Email' },
                    { value: 'sms', label: 'Send via SMS' },
                  ]}
                />
              </div>
              {formError ? <div className="errorbox mt3" role="alert">{formError}</div> : null}
              <FP_Button type="submit" fullWidth size="lg" className="mt4" loading={busy}>Send code</FP_Button>
            </form>
          ) : null}

          {mode === 'otp' ? (
            <form onSubmit={submitOtp} noValidate>
              <FP_IconButton small icon={ArrowLeft} label="Back to sign in" onPress={backToLogin} />
              <h1 className="login__title mt3">Verify code</h1>
              <p className="login__sub">We sent a 4-digit code to <b className="accent">{otpDest}</b>.</p>
              <div className="mt4">
                <FP_OtpInput value={code} onChange={setCode} autoFocus />
              </div>
              <FP_Row between className="mt3">
                <span className="muted small">Didn&apos;t get it?</span>
                <FP_Button variant="ghost" size="sm" onPress={resendOtp}>Resend code</FP_Button>
              </FP_Row>
              {formError ? <div className="errorbox mt3" role="alert">{formError}</div> : null}
              <FP_Button type="submit" fullWidth size="lg" className="mt4" loading={busy}>Verify</FP_Button>
            </form>
          ) : null}

          {mode === 'reset' ? (
            <form onSubmit={submitReset} noValidate>
              <h1 className="login__title">New password</h1>
              <p className="login__sub">Choose a password of at least 6 characters.</p>
              <div className="mt4 col">
                <FP_Textbox
                  label="New password"
                  secure
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  error={fieldErrors.newPassword}
                  large
                  autoFocus
                />
                <FP_Textbox
                  label="Confirm password"
                  secure
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={fieldErrors.confirmPassword}
                  large
                />
              </div>
              {formError ? <div className="errorbox mt3" role="alert">{formError}</div> : null}
              <FP_Button type="submit" fullWidth size="lg" className="mt4" loading={busy}>Save password</FP_Button>
            </form>
          ) : null}
        </FP_Card>

        <div className="login__foot">CMS v{APP_VERSION}</div>
      </div>
    </div>
  );
}
