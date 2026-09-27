/**
 * Client · Profile (docs/prototype.html `SCREENS.profile`).
 *
 * Avatar card (name · email · phone · plan badge) → body measurements incl. the API-computed BMI →
 * my goals → "Edit my details" (the Onboarding screen in edit mode) → log out.
 *
 * In guest preview the badge becomes `guest.profile_badge` and the log-out button is replaced by
 * `guest.profile_cta`, which the FP_ gate turns into the login modal (CONTRACT §13).
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  FP_AppHeader,
  FP_Avatar,
  FP_Badge,
  FP_Button,
  FP_Card,
  FP_KeyValueRow,
  FP_Screen,
} from '../../components';
import { useAuth } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import { useToast } from '../../components/FP_ToastProvider';
import { PREVIEW_BMI, PREVIEW_CLIENT_PROFILE } from '../../guest/previewData';
import type { RootStackParamList } from '../../navigation/types';
import { FP_SPACING, FP_TYPE } from '../../theme';
import { TAB_BAR_CLEARANCE, useClientContext } from './useClientContext';
import FP_SectionHeader from './components/FP_SectionHeader';

/** Unit suffixes and the prototype's em-dash placeholder for a blank measurement. */
const UNIT_CM = 'cm';
const UNIT_KG = 'kg';
const BLANK = '—';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t } = useContent();
  const { toast } = useToast();
  const { logout } = useAuth();
  const { isGuest, user, displayName } = useClientContext();
  const [signingOut, setSigningOut] = useState(false);

  const profile = isGuest ? PREVIEW_CLIENT_PROFILE : user?.clientProfile;
  const bmi = isGuest ? PREVIEW_BMI : user?.bmi ?? null;

  const value = (raw: string | number | null | undefined, unit?: string) =>
    raw === null || raw === undefined || raw === '' ? BLANK : `${raw}${unit ? ` ${unit}` : ''}`;

  const editDetails = useCallback(
    () => navigation.navigate('Onboarding', { mode: 'edit' }),
    [navigation],
  );

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await logout();
      toast(t('profile.toast_logout'));
    } finally {
      setSigningOut(false);
    }
  }, [logout, toast, t]);

  return (
    <FP_Screen bottomInset={TAB_BAR_CLEARANCE}>
      <FP_AppHeader title={t('profile.title')} large />

      <FP_Card style={[styles.blockSm, styles.center]}>
        <FP_Avatar name={displayName} size={88} />
        <Text style={styles.name}>{displayName}</Text>
        {!isGuest && user ? (
          <Text style={FP_TYPE.sub}>
            {[user.email, user.phone].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        <FP_Badge
          label={isGuest ? t('guest.profile_badge') : t('profile.badge_client')}
          tone="pt"
          style={styles.badge}
        />
      </FP_Card>

      <FP_SectionHeader
        small
        title={t('profile.body_measurements')}
        actionLabel={t('common.cta_edit')}
        onPressAction={editDetails}
        style={styles.section}
      />
      <FP_Card style={styles.blockXs}>
        <FP_KeyValueRow
          label={t('profile.row_gender_age')}
          value={`${value(profile?.gender)} · ${value(profile?.age)}`}
        />
        <FP_KeyValueRow label={t('profile.row_height')} value={value(profile?.heightCm, UNIT_CM)} />
        <FP_KeyValueRow label={t('profile.row_weight')} value={value(profile?.weightKg, UNIT_KG)} />
        <FP_KeyValueRow label={t('profile.row_bmi')} value={value(bmi)} />
        <FP_KeyValueRow
          label={t('profile.row_bodyfat')}
          value={profile?.bodyFatPct ? `${profile.bodyFatPct}%` : BLANK}
        />
        <FP_KeyValueRow
          label={t('profile.row_waist')}
          value={value(profile?.waistCm, UNIT_CM)}
          last
        />
      </FP_Card>

      <FP_SectionHeader small title={t('profile.my_goals')} style={styles.section} />
      <FP_Card style={styles.blockXs}>
        <FP_KeyValueRow label={t('profile.row_goal')} value={value(profile?.goal)} />
        <FP_KeyValueRow
          label={t('profile.row_target')}
          value={value(profile?.targetWeightKg, UNIT_KG)}
        />
        <FP_KeyValueRow
          label={t('profile.row_sessions')}
          value={value(profile?.sessionsPerWeek)}
        />
        <FP_KeyValueRow label={t('profile.row_level')} value={value(profile?.level)} last />
      </FP_Card>

      <FP_Button
        variant="ghost"
        title={t('profile.cta_edit')}
        onPress={editDetails}
        style={styles.section}
      />
      {isGuest ? (
        /* the guest gate inside FP_Button turns this into the Login modal */
        <FP_Button title={t('guest.profile_cta')} style={styles.blockSm} />
      ) : (
        <FP_Button
          variant="danger"
          title={t('profile.cta_logout')}
          loading={signingOut}
          onPress={() => void signOut()}
          style={styles.blockSm}
        />
      )}
      <View style={styles.tail} />
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  blockXs: { marginTop: FP_SPACING.sm },
  blockSm: { marginTop: FP_SPACING.md },
  section: { marginTop: FP_SPACING.xl },
  name: { ...FP_TYPE.screenTitleSm, fontSize: 20, marginTop: FP_SPACING.md },
  badge: { marginTop: 10 },
  tail: { height: FP_SPACING.sm },
});

export default ProfileScreen;
