/**
 * Typed param lists for the whole app (CONTRACT §13.1).
 *
 * The route names here are the contract between `navigationRef.ts` (deep links from a
 * notification tap), `RootNavigator.tsx` and every screen that calls `navigation.navigate`.
 * Do not rename them without updating `navigationRef.ts`.
 *
 *   RootStack
 *     ├── ClientTabs   base screen when guest or role==='client'   (the "AppTabs" slot)
 *     ├── PtTabs       base screen when role==='trainer'           (the "AppTabs" slot)
 *     ├── Login        \
 *     ├── Register      |
 *     ├── Forgot        |  presentation: 'modal', on top of the tabs
 *     ├── Otp           |
 *     ├── ResetPassword |
 *     └── Onboarding   /
 *     (+ Nutrition, Search, Notifications, AdminNotice — pushed)
 */
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { OtpChannel, OtpPurpose } from '@firon/shared';

/** Home · Train · Videos · Profile (CONTRACT §3.2). */
export type ClientTabParamList = {
  Home: undefined;
  Train: undefined;
  /** A `firon://video/<id>` deep link lands here with the video pre-opened. */
  Videos: { videoId?: string } | undefined;
  Profile: undefined;
};

/** Clients · Plans · Uploads · Profile (CONTRACT §3.2). */
export type PtTabParamList = {
  Clients: { clientId?: string } | undefined;
  Plans: { clientId?: string } | undefined;
  Uploads: undefined;
  /** Named `PtProfile` so it cannot collide with the client tab in `FP_TabBar`'s map. */
  PtProfile: undefined;
};

/** `Otp` is reached from Register (`verify`), Login-on-NOT_VERIFIED and Forgot (`reset`). */
export interface OtpRouteParams {
  /** Register / a NOT_VERIFIED login give us the id; the reset flow only has a destination. */
  userId?: string;
  /** Masked destination shown in `auth.otp.subtitle` — `{dest}`. */
  destination: string;
  purpose: OtpPurpose;
  /** Which channel the code went out on, so "Resend" repeats it. */
  channel?: OtpChannel;
  /** Carried through the reset flow so the success toast can go back to a pre-filled Login. */
  identifier?: string;
}

/** Onboarding doubles as "A bit about you" (signup) and "My details" (edit from Profile). */
export type OnboardingMode = 'signup' | 'edit';

export type RootStackParamList = {
  /* ---- the AppTabs slot: exactly one of these is the base screen ---- */
  ClientTabs: NavigatorScreenParams<ClientTabParamList> | undefined;
  PtTabs: NavigatorScreenParams<PtTabParamList> | undefined;

  /* ---- auth, presented modally over the tabs ---- */
  Login: { identifier?: string } | undefined;
  Register: undefined;
  Forgot: undefined;
  Otp: OtpRouteParams;
  ResetPassword: { resetToken: string; identifier?: string };
  Onboarding: { mode?: OnboardingMode } | undefined;

  /* ---- pushed screens ---- */
  Nutrition: undefined;
  Search: undefined;
  Notifications: undefined;
  AdminNotice: undefined;
};

export type RootRouteName = keyof RootStackParamList;
