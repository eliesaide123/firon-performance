/**
 * Onboarding — the prototype's `onboard` screen, which it reuses for two jobs:
 *
 *   mode 'signup'  "A bit about you"  — shown once, right after verification
 *   mode 'edit'    "My details"       — opened from Profile → `profile.cta_edit`
 *
 * Validation is the prototype's `saveMyDetails()` rule: height 100–250 cm and weight
 * 30–300 kg, both red-bordered with the single shared `onboard.err_body` message beneath the
 * row. Everything else is optional.
 *
 * Saves through `api.profile.saveClientDetails()` (CONTRACT §11.1 — never `fetch`), then patches
 * the cached user. In signup mode that flips `onboardingCompleted`, which changes the session
 * identity and makes `RootNavigator` reset onto the client tabs.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '@firon/shared';
import type { ClientProfile, Gender, Goal, Level } from '@firon/shared';
import {
  FP_Button,
  FP_Chip,
  FP_ChipScroll,
  FP_CmsText,
  FP_FieldError,
  FP_Row,
  FP_Screen,
  FP_Segmented,
  FP_Textbox,
  useToast,
} from '../../components';
import { useAuth, useCoachName } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import log from '../../log';
import { FP_COLORS } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import FP_AuthHeader from './components/FP_AuthHeader';
import { isHeightCm, isWeightKg, parseNumber } from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const GENDERS: readonly Gender[] = ['Male', 'Female', 'Other'];
const GOALS: readonly Goal[] = ['Fat loss', 'Muscle gain', 'Strength', 'General fitness'];
const LEVELS: readonly Level[] = ['Beginner', 'Intermediate', 'Advanced'];
const SESSIONS: readonly number[] = [2, 3, 4, 5, 6];

/** Pre-fill from the cached profile so "My details" opens on the current values. */
function toText(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

export const OnboardingScreen: React.FC<Props> = ({ navigation, route }) => {
  const mode = route.params?.mode ?? 'signup';
  const isEdit = mode === 'edit';

  const { t } = useContent();
  const { toast } = useToast();
  const { user, patchUser } = useAuth();
  const coach = useCoachName();

  const profile = user?.clientProfile;

  const [gender, setGender] = useState<Gender>(profile?.gender ?? 'Male');
  const [age, setAge] = useState(toText(profile?.age));
  const [height, setHeight] = useState(toText(profile?.heightCm));
  const [weight, setWeight] = useState(toText(profile?.weightKg));
  const [bodyFat, setBodyFat] = useState(toText(profile?.bodyFatPct));
  const [waist, setWaist] = useState(toText(profile?.waistCm));
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'Fat loss');
  const [target, setTarget] = useState(toText(profile?.targetWeightKg));
  const [sessions, setSessions] = useState<number>(profile?.sessionsPerWeek ?? 4);
  const [level, setLevel] = useState<Level>(profile?.level ?? 'Intermediate');
  const [bodyError, setBodyError] = useState(false);
  const [busy, setBusy] = useState(false);

  const heightValue = useMemo(() => parseNumber(height), [height]);
  const weightValue = useMemo(() => parseNumber(weight), [weight]);
  const badHeight = bodyError && !(heightValue !== null && isHeightCm(heightValue));
  const badWeight = bodyError && !(weightValue !== null && isWeightKg(weightValue));

  const optional = useCallback(
    (key: string) => `${t(key)} ${t('onboard.optional')}`,
    [t],
  );

  const submit = useCallback(async () => {
    if (
      heightValue === null ||
      weightValue === null ||
      !isHeightCm(heightValue) ||
      !isWeightKg(weightValue)
    ) {
      setBodyError(true);
      return;
    }
    setBodyError(false);

    const body: ClientProfile = {
      gender,
      age: parseNumber(age) ?? undefined,
      heightCm: heightValue,
      weightKg: weightValue,
      bodyFatPct: parseNumber(bodyFat),
      waistCm: parseNumber(waist),
      goal,
      targetWeightKg: parseNumber(target),
      sessionsPerWeek: sessions,
      level,
      // `onboardingCompleted` is NOT sent: the route validator is `.strict()` and the
      // controller flips the flag itself on every successful save.
    };

    setBusy(true);
    try {
      const saved = await api.profile.saveClientDetails(body);
      patchUser(saved);

      if (isEdit) {
        toast(t('common.toast_saved'));
        navigation.goBack();
      } else {
        // The session identity just changed (onboardingCompleted), so RootNavigator resets onto
        // the client tabs on its own — we only announce it.
        toast(t('onboard.toast_signup', { first: (saved.name ?? '').split(' ')[0] ?? '' }));
      }
    } catch (err) {
      log.info('saveClientDetails failed', (err as { code?: string }).code);
    } finally {
      setBusy(false);
    }
  }, [
    heightValue,
    weightValue,
    gender,
    age,
    bodyFat,
    waist,
    goal,
    target,
    sessions,
    level,
    isEdit,
    patchUser,
    navigation,
    toast,
    t,
  ]);

  return (
    <FP_Screen testID="screen-onboarding">
      <FP_AuthHeader
        titleKey={isEdit ? 'onboard.title_edit' : 'onboard.title_signup'}
        subtitleKey={isEdit ? 'onboard.subtitle_edit' : 'onboard.subtitle_signup'}
        subtitleVars={{ coach }}
        onBack={isEdit ? () => navigation.goBack() : undefined}
      />

      {/* ---- gender ---- */}
      <FP_CmsText k="onboard.gender" style={styles.sectionLabel} />
      <FP_Segmented
        guestAllowed
        testID="onboard-gender"
        options={GENDERS}
        value={gender}
        onChange={setGender}
        style={styles.afterLabel}
      />

      {/* ---- age / height / weight ---- */}
      <FP_Row gap={8} align="flex-start" style={styles.row}>
        <View style={styles.grow}>
          <FP_Textbox
            guestAllowed
            testID="onboard-age"
            label={t('onboard.age')}
            placeholder={t('onboard.age_ph')}
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.grow}>
          <FP_Textbox
            guestAllowed
            testID="onboard-height"
            label={t('onboard.height')}
            placeholder={t('onboard.height_ph')}
            value={height}
            onChangeText={value => {
              setHeight(value);
              if (bodyError) setBodyError(false);
            }}
            invalid={badHeight}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.grow}>
          <FP_Textbox
            guestAllowed
            testID="onboard-weight"
            label={t('onboard.weight')}
            placeholder={t('onboard.weight_ph')}
            value={weight}
            onChangeText={value => {
              setWeight(value);
              if (bodyError) setBodyError(false);
            }}
            invalid={badWeight}
            keyboardType="decimal-pad"
          />
        </View>
      </FP_Row>
      <FP_FieldError message={t('onboard.err_body')} visible={bodyError} />

      {/* ---- optional body-fat / waist ---- */}
      <FP_Row gap={8} align="flex-start" style={styles.rowTight}>
        <View style={styles.grow}>
          <FP_Textbox
            guestAllowed
            testID="onboard-bodyfat"
            label={optional('onboard.bodyfat')}
            placeholder={t('onboard.bodyfat_ph')}
            value={bodyFat}
            onChangeText={setBodyFat}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.grow}>
          <FP_Textbox
            guestAllowed
            testID="onboard-waist"
            label={optional('onboard.waist')}
            placeholder={t('onboard.waist_ph')}
            value={waist}
            onChangeText={setWaist}
            keyboardType="number-pad"
          />
        </View>
      </FP_Row>

      {/* ---- primary goal ---- */}
      <FP_CmsText k="onboard.goal" style={styles.sectionLabel} />
      <FP_ChipScroll style={styles.afterLabel}>
        {GOALS.map(option => (
          <FP_Chip
            key={option}
            guestAllowed
            label={option}
            active={goal === option}
            onPress={() => setGoal(option)}
            testID={`onboard-goal-${option}`}
          />
        ))}
      </FP_ChipScroll>

      {/* ---- target weight ---- */}
      <FP_Row gap={8} style={styles.row}>
        <View style={styles.grow}>
          <FP_Textbox
            guestAllowed
            testID="onboard-target"
            label={t('onboard.target')}
            placeholder={t('onboard.target_ph')}
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
          />
        </View>
      </FP_Row>

      {/* ---- sessions per week ---- */}
      <FP_CmsText k="onboard.sessions" style={styles.sectionLabel} />
      <FP_Segmented
        guestAllowed
        testID="onboard-sessions"
        options={SESSIONS}
        value={sessions}
        onChange={setSessions}
        style={styles.afterLabel}
      />

      {/* ---- training experience ---- */}
      <FP_CmsText k="onboard.level" style={styles.sectionLabel} />
      <FP_ChipScroll style={styles.afterLabel}>
        {LEVELS.map(option => (
          <FP_Chip
            key={option}
            guestAllowed
            label={option}
            active={level === option}
            onPress={() => setLevel(option)}
            testID={`onboard-level-${option}`}
          />
        ))}
      </FP_ChipScroll>

      <FP_Button
        guestAllowed
        testID="onboard-submit"
        title={t(isEdit ? 'onboard.cta_edit' : 'onboard.cta_signup')}
        loading={busy}
        onPress={() => void submit()}
        style={styles.submit}
      />

      {isEdit ? null : (
        <FP_CmsText k="onboard.footnote" variant="tiny" style={styles.footnote} />
      )}
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  grow: { flex: 1 },
  sectionLabel: {
    marginTop: 20,
    fontSize: 12.5,
    fontWeight: '700',
    color: FP_COLORS.muted,
  },
  afterLabel: { marginTop: 8 },
  row: { marginTop: 16 },
  rowTight: { marginTop: 12 },
  submit: { marginTop: 24 },
  footnote: { textAlign: 'center', marginTop: 12 },
});

export default OnboardingScreen;
