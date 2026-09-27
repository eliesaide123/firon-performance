/**
 * Firon Performance — app root.
 *
 * Provider order matters and is fixed:
 *
 *   SafeAreaProvider          insets for FP_Screen / FP_TabBar / the notification banner
 *     FP_AlertProvider        the single subscriber to @firon/shared's alert bus (§11.4)
 *       FP_ToastProvider      useToast() — the prototype's floating pill
 *         ContentProvider     every user-visible string; must sit ABOVE anything that reads t()
 *           AuthProvider      the session; `user.role` is the only routing input (§3)
 *             GuestGateProvider   isGuest = !signedIn; reads t() for its explainer copy (§13.2)
 *               NotificationsProvider  enabled={signedIn} — its unread-count call is authed
 *                 SocketProvider    self-guarding; calls useNotificationsBadge(), so it must
 *                                   sit INSIDE NotificationsProvider
 *                   PushProvider    enabled={signedIn} — renders nothing; owns the FCM token
 *                                   lifecycle and notification-tap deep links (§7)
 *                   NavigationContainer + RootNavigator
 *
 * `src/bootstrap.ts` (imported first by index.js) has already configured @firon/shared, so any
 * provider below may make an API call immediately.
 */
import React, { useCallback } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { FP_AlertProvider, FP_ToastProvider } from './src/components';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { ContentProvider } from './src/cms/ContentProvider';
import { GuestGateProvider } from './src/guest/GuestGateProvider';
import { SocketProvider } from './src/realtime/SocketProvider';
import { NotificationsProvider } from './src/store/NotificationsProvider';
import { PushProvider } from './src/push';
import RootNavigator from './src/navigation/RootNavigator';
import FP_NAV_THEME from './src/navigation/navTheme';
import { flushPendingDeepLink, navigationRef } from './src/navigation/navigationRef';

/**
 * Everything that needs the session. Split out because `GuestGateProvider` and
 * `NotificationsProvider` both take props derived from `useAuth()`.
 */
const AppSession: React.FC = () => {
  const { signedIn } = useAuth();

  // The gate lives in the FP_ primitives; all it needs from us is a way to open the modal.
  const requireAuth = useCallback(() => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Login');
    }
  }, []);

  // A notification tapped before the navigator mounted is replayed here (CONTRACT §7).
  const onReady = useCallback(() => {
    flushPendingDeepLink();
  }, []);

  return (
    <GuestGateProvider isGuest={!signedIn} onRequireAuth={requireAuth}>
      <NotificationsProvider enabled={signedIn}>
        <SocketProvider>
          {/* Renders null. Registers the FCM token after login, removes it on logout, and routes
              notification taps (CONTRACT §7). No-ops when Firebase is not configured. */}
          <PushProvider enabled={signedIn} />
          <NavigationContainer ref={navigationRef} theme={FP_NAV_THEME} onReady={onReady}>
            <RootNavigator />
          </NavigationContainer>
        </SocketProvider>
      </NotificationsProvider>
    </GuestGateProvider>
  );
};

function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      {/* Dark theme only (CONTRACT §2) — the status bar is always light on the #0b0f0d bg. */}
      <StatusBar barStyle="light-content" />
      <FP_AlertProvider>
        <FP_ToastProvider>
          <ContentProvider>
            <AuthProvider>
              <AppSession />
            </AuthProvider>
          </ContentProvider>
        </FP_ToastProvider>
      </FP_AlertProvider>
    </SafeAreaProvider>
  );
}

export default App;
