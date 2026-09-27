/**
 * The root native stack (CONTRACT §13.1).
 *
 *   RootStack
 *     ├── ClientTabs / PtTabs      the "AppTabs" slot — exactly one is the base screen
 *     ├── Login · Register · Forgot · Otp · ResetPassword · Onboarding   presentation: 'modal'
 *     └── Nutrition · Search · Notifications · AdminNotice               pushed
 *
 * Boot table:
 *
 *   | stored session                          | mounted stack                        |
 *   |-----------------------------------------|--------------------------------------|
 *   | none                                    | [ClientTabs]  (guest preview)        |
 *   | role 'client'                           | [ClientTabs]                         |
 *   | role 'trainer'                          | [PtTabs]                             |
 *   | role 'admin'                            | [AdminNotice]                        |
 *   | client, onboardingCompleted === false   | [Onboarding(signup)]                 |
 *
 * The important bit: **we never `goBack` out of the Login modal.** A trainer who signed in from
 * the client-flavoured guest preview must land in the PT tabs, so any change of session identity
 * does a full `reset` onto the stack the boot table prescribes. That also dismisses the auth
 * modal for a client (whose base screen did not change) and returns a logged-out user to the
 * guest preview rather than a bare login form.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { User, UserRole } from '@firon/shared';
import { FP_Spinner } from '../components';
import { useAuth } from '../auth/AuthProvider';
import log from '../log';
import { FP_COLORS } from '../theme';
import { flushPendingDeepLink, navigationRef } from './navigationRef';
import { RootStackParamList } from './types';
import ClientTabs from './ClientTabs';
import PtTabs from './PtTabs';
import {
  NotificationsScreen,
  NutritionScreen,
  SearchScreen,
} from './screens';
import AdminNoticeScreen from '../screens/auth/AdminNoticeScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Auth screens slide up over the preview and can be swiped away again. */
const MODAL: NativeStackNavigationOptions = {
  presentation: 'modal',
  gestureEnabled: true,
};

/** Signup onboarding is not dismissible — there is nothing useful behind it yet. */
const BLOCKING_MODAL: NativeStackNavigationOptions = {
  presentation: 'modal',
  gestureEnabled: false,
};

type BootRoute = { name: keyof RootStackParamList; params?: object };

/**
 * The stack the boot table prescribes for a session. Returned as a full route list so a
 * `reset` can land a user mid-flow (e.g. straight into Onboarding with tabs underneath).
 */
export function bootRoutes(user: User | null): BootRoute[] {
  const role: UserRole | null = user?.role ?? null;

  if (role === 'admin') {
    // Admins may only use the web CMS (CONTRACT §3.2). No tabs, no portal.
    return [{ name: 'AdminNotice' }];
  }
  if (role === 'trainer') {
    return [{ name: 'PtTabs' }];
  }
  if (role === 'client' && user?.clientProfile?.onboardingCompleted === false) {
    // Nothing behind it on purpose: the app is unusable until the details are in.
    return [{ name: 'Onboarding', params: { mode: 'signup' } }];
  }
  // Signed-in client, or a guest: the client preview either way.
  return [{ name: 'ClientTabs' }];
}

/**
 * Identity of the mounted session. When this string changes the stack is rebuilt — that is the
 * single trigger for "log in", "log out", "finished onboarding" and "role changed".
 */
function sessionKey(user: User | null): string {
  if (!user) {
    return 'guest';
  }
  // Only a client can be mid-onboarding; a trainer's empty `clientProfile` default must not
  // make the key flap.
  const stage =
    user.role === 'client' && user.clientProfile?.onboardingCompleted === false
      ? 'onboarding'
      : 'ready';
  return [user.id, user.role, stage].join(':');
}

export const RootNavigator: React.FC = () => {
  const { boot, user } = useAuth();

  const routes = useMemo(() => bootRoutes(user), [user]);
  const key = sessionKey(user);
  /** `undefined` until the stack has mounted once, so the first render does not reset. */
  const mountedKey = useRef<string | undefined>(undefined);

  const applyBootRoutes = useCallback((next: BootRoute[], reason: string) => {
    const run = (): void => {
      if (!navigationRef.isReady()) {
        return;
      }
      log.info('navigation reset →', next.map(r => r.name).join(' / '), `(${reason})`);
      navigationRef.reset({ index: next.length - 1, routes: next as never });
    };
    if (navigationRef.isReady()) {
      run();
    } else {
      // Child effects run before the container marks itself ready; retry on the next tick.
      setTimeout(run, 0);
    }
  }, []);

  useEffect(() => {
    if (boot !== 'ready') {
      return;
    }
    if (mountedKey.current === undefined) {
      // First mount after boot: `initialRouteName` already put us on the right screen.
      mountedKey.current = key;
      // Belt and braces for a notification tapped before the stack existed: the container's
      // `onReady` normally flushes it, but the stack mounts a tick after boot flips to 'ready'.
      setTimeout(flushPendingDeepLink, 0);
      return;
    }
    if (mountedKey.current === key) {
      return;
    }
    mountedKey.current = key;
    applyBootRoutes(routes, key);
  }, [boot, key, routes, applyBootRoutes]);

  if (boot === 'booting') {
    return (
      <View style={styles.splash}>
        <FP_Spinner size="large" color={FP_COLORS.accent} />
      </View>
    );
  }

  const initialRouteName = routes[0].name;

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: FP_COLORS.bg },
        animation: 'slide_from_right',
      }}
    >
      {/* ---- the AppTabs slot. Both are registered so deep links resolve either way. ---- */}
      <Stack.Screen name="ClientTabs" component={ClientTabs} />
      <Stack.Screen name="PtTabs" component={PtTabs} />

      {/* ---- auth, modally over the tabs ---- */}
      <Stack.Screen name="Login" component={LoginScreen} options={MODAL} />
      <Stack.Screen name="Register" component={RegisterScreen} options={MODAL} />
      <Stack.Screen name="Forgot" component={ForgotPasswordScreen} options={MODAL} />
      <Stack.Screen name="Otp" component={OtpScreen} options={MODAL} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={MODAL} />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        initialParams={{ mode: 'signup' }}
        options={({ route }) => (route.params?.mode === 'edit' ? MODAL : BLOCKING_MODAL)}
      />

      {/* ---- pushed screens ---- */}
      <Stack.Screen name="Nutrition" component={NutritionScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="AdminNotice" component={AdminNoticeScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: FP_COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RootNavigator;
