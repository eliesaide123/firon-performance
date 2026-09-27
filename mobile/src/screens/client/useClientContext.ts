/**
 * Shared plumbing for the client tabs.
 *
 * Every client screen needs the same four things: whether we are in guest preview (CONTRACT §13),
 * the display name, the coach's first name for the `{coach}` interpolations, and the time-of-day
 * greeting key. Resolving them once here keeps the screens free of that branching.
 */
import { useMemo } from 'react';
import type { User } from '@firon/shared';
import { useAuth } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import { useGuestGate } from '../../guest/GuestGateProvider';
import { FP_SPACING } from '../../theme';

/** Clearance under the last card so the tab bar + guest banner never cover it. */
export const TAB_BAR_CLEARANCE = FP_SPACING.xxl * 2;

/**
 * `GET /auth/me` populates the joined trainer with a few flat coaching fields
 * (`studio`, `title`, `firstName`) that `User['trainer']` does not name yet. Reading them through
 * this structural widening keeps the screens type-safe without redeclaring the DTO.
 */
export type ClientTrainerRef = NonNullable<User['trainer']> & {
  studio?: string | null;
  title?: string | null;
  firstName?: string | null;
};

export function firstNameOf(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

/** `home.greeting_morning` / `_afternoon` / `_evening`, picked off the device clock. */
export function greetingKeyForHour(hour: number): string {
  if (hour < 12) {
    return 'home.greeting_morning';
  }
  if (hour < 18) {
    return 'home.greeting_afternoon';
  }
  return 'home.greeting_evening';
}

export interface ClientContext {
  isGuest: boolean;
  /** the signed-in user, or null in guest preview */
  user: User | null;
  trainer: ClientTrainerRef | null;
  /** coach first name for `{coach}` — `guest.coach_name` while previewing */
  coach: string;
  /** full display name for the profile card — `guest.display_name` while previewing */
  displayName: string;
  /** first name for the Home header */
  firstName: string;
  /** resolved greeting — `guest.greeting` while previewing */
  greeting: string;
}

export function useClientContext(): ClientContext {
  const { isGuest } = useGuestGate();
  const { user } = useAuth();
  const { t } = useContent();

  return useMemo(() => {
    const trainer = (user?.trainer ?? null) as ClientTrainerRef | null;
    const guestName = t('guest.display_name');
    const displayName = isGuest ? guestName : user?.name ?? guestName;
    const coach = isGuest
      ? t('guest.coach_name')
      : firstNameOf(trainer?.firstName ?? trainer?.name) || t('guest.coach_name');

    return {
      isGuest,
      user: isGuest ? null : user,
      trainer: isGuest ? null : trainer,
      coach,
      displayName,
      firstName: firstNameOf(displayName),
      greeting: isGuest ? t('guest.greeting') : t(greetingKeyForHour(new Date().getHours())),
    };
  }, [isGuest, user, t]);
}

export default useClientContext;
