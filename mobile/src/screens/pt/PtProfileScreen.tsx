/**
 * PT tab 4 — the prototype's `pt-profile` screen plus `editCoachSheet()` / `saveCoach()`,
 * `togglePref()`, `availabilitySheet()` (read-only) and the draft-based availability editor.
 *
 * `availabilitySummary` arrives already collapsed from `GET /trainer/profile`, so the
 * prototype's range-collapsing helper is not reimplemented here.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  api,
  type AvailabilityDay,
  type TrainerPrefs,
  type TrainerProfileResponse,
} from '@firon/shared';
import {
  FP_AppHeader,
  FP_Badge,
  FP_BottomSheet,
  FP_Button,
  FP_Card,
  FP_Chip,
  FP_CmsText,
  FP_ErrorState,
  FP_Icon,
  FP_KeyValueRow,
  FP_ListItem,
  FP_Row,
  FP_Screen,
  FP_Skeleton,
  FP_StatCard,
  FP_Textbox,
} from '../../components';
import { useAuth } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import { useToast } from '../../components/FP_ToastProvider';
import useResource from '../../store/useResource';
import { QK } from '../../store/queryCache';
import type { TrainerStats } from '@firon/shared';
import { FP_COLORS, FP_SPACING } from '../../theme';
import FP_PtAvailabilityEditor from './components/FP_PtAvailabilityEditor';
import FP_PtIdentityCard from './components/FP_PtIdentityCard';
import FP_PtSectionHead from './components/FP_PtSectionHead';
import FP_PtSheetHead from './components/FP_PtSheetHead';
import FP_PtTextButton from './components/FP_PtTextButton';
import { fpIsEmail } from './ptUtils';

type SheetMode = 'coach' | 'availability' | 'availability-edit' | null;

const PREF_ROWS: ReadonlyArray<{ key: keyof TrainerPrefs; label: string }> = [
  { key: 'newClientRequests', label: 'pt.profile.pref_new_clients' },
  { key: 'sessionReminders', label: 'pt.profile.pref_reminders' },
  { key: 'weeklyAdherenceReport', label: 'pt.profile.pref_adherence' },
] as const;

const PtProfileScreen: React.FC = () => {
  const { t } = useContent();
  const { toast } = useToast();
  const { logout, patchUser } = useAuth();

  const profile = useResource<TrainerProfileResponse>(QK.trainerProfile, () =>
    api.trainer.getProfile(),
  );
  const stats = useResource<TrainerStats>(QK.clientStats, () => api.clients.stats());

  const [sheet, setSheet] = useState<SheetMode>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    studio: '',
    rate: '',
  });
  const [formErrors, setFormErrors] = useState({ name: false, email: false });

  const coach = profile.data;
  const availability = useMemo<AvailabilityDay[]>(() => coach?.availability ?? [], [coach]);
  const summary = coach?.availabilitySummary ?? [];

  const refresh = useCallback(async () => {
    await Promise.all([profile.refresh(), stats.refresh()]);
  }, [profile, stats]);

  /* ------------------------------ edit profile ----------------------------- */

  const openCoachSheet = useCallback(() => {
    setForm({
      name: coach?.name ?? '',
      title: coach?.title ?? '',
      email: coach?.email ?? '',
      phone: coach?.phone ?? '',
      studio: coach?.studio ?? '',
      rate: coach?.rate ?? '',
    });
    setFormErrors({ name: false, email: false });
    setSheet('coach');
  }, [coach]);

  const saveCoach = useCallback(async () => {
    const name = form.name.trim();
    const email = form.email.trim();
    const errors = { name: !name, email: !fpIsEmail(email) };
    setFormErrors(errors);
    if (errors.name || errors.email) {
      return;
    }

    setSaving(true);
    try {
      /* `PUT /trainer/profile` is strict and owns title/studio/rate; email + phone live on
         `PUT /profile`, so the sheet fans out to both. */
      const updated = await api.trainer.updateProfile({
        name,
        title: form.title.trim() || undefined,
        studio: form.studio.trim() || undefined,
        rate: form.rate.trim() || undefined,
      });
      const contactChanged = email !== (coach?.email ?? '') || form.phone.trim() !== (coach?.phone ?? '');
      if (contactChanged) {
        await api.profile.update({ email, phone: form.phone.trim() || undefined });
      }
      profile.setData({ ...updated, email, phone: form.phone.trim() || updated.phone });
      patchUser({ name, email, phone: form.phone.trim() || undefined });
      setSheet(null);
      toast(t('pt.profile.toast_saved'));
    } finally {
      setSaving(false);
    }
  }, [coach, form, patchUser, profile, t, toast]);

  /* -------------------------------- prefs --------------------------------- */

  const togglePref = useCallback(
    async (key: keyof TrainerPrefs) => {
      if (!coach) {
        return;
      }
      const current = coach.prefs?.[key] ?? false;
      const next = !current;
      /* optimistic, like the prototype's immediate re-render */
      profile.setData(prev => {
        const base = prev ?? coach;
        return { ...base, prefs: { ...(base.prefs as TrainerPrefs), [key]: next } };
      });
      const saved = await api.trainer.updatePrefs({ [key]: next });
      profile.setData(prev => ({ ...(prev ?? coach), prefs: saved }));
      toast(t(next ? 'pt.profile.on' : 'pt.profile.off'));
    },
    [coach, profile, t, toast],
  );

  /* ----------------------------- availability ----------------------------- */

  const saveAvailability = useCallback(
    async (draft: AvailabilityDay[]) => {
      if (!coach) {
        return;
      }
      setSaving(true);
      try {
        const result = await api.trainer.updateAvailability({ availability: draft });
        profile.setData(prev => ({
          ...(prev ?? coach),
          availability: result.availability,
          availabilitySummary: result.summary,
          openDays: result.openDays,
        }));
        setSheet(null);
        const open = result.openDays;
        toast(t('pt.profile.toast_availability', { open: `${open} ${open === 1 ? 'day' : 'days'}` }));
      } finally {
        setSaving(false);
      }
    },
    [coach, profile, t, toast],
  );

  const header = <FP_AppHeader large title={t('profile.title')} />;

  if (profile.error) {
    return (
      <FP_Screen>
        {header}
        <FP_ErrorState
          title={t('common.error_generic')}
          message={profile.error.message}
          retryLabel={t('common.retry')}
          onRetry={profile.refresh}
        />
      </FP_Screen>
    );
  }

  if (!coach) {
    return (
      <FP_Screen>
        {header}
        <FP_Skeleton height={190} style={styles.block} />
        <FP_Skeleton height={64} style={styles.block} />
        <FP_Skeleton height={140} style={styles.block} />
      </FP_Screen>
    );
  }

  return (
    <FP_Screen onRefresh={refresh} refreshing={profile.loading && !profile.initialLoading}>
      {header}
      <FP_PtIdentityCard
        name={coach.name}
        title={coach.title}
        contact={[coach.email, coach.phone].filter(Boolean).join(' · ')}
        badgeLabel={t('pt.profile.badge_trainer')}
      />

      <FP_Row style={styles.statRow} gap={10} align="stretch">
        <FP_StatCard
          accent
          value={String(stats.data?.totalClients ?? 0)}
          label={t('pt.profile.stat_clients')}
        />
        <FP_StatCard
          value={String(stats.data?.sessionsThisWeek ?? 0)}
          label={t('pt.profile.stat_sessions')}
        />
        <FP_StatCard
          value={`${Math.round(stats.data?.avgAdherence ?? 0)}%`}
          label={t('pt.profile.stat_adherence')}
        />
      </FP_Row>

      <FP_PtSectionHead
        k="pt.profile.coaching_details"
        actionKey="common.cta_edit"
        onAction={openCoachSheet}
      />
      <FP_Card style={styles.card}>
        <FP_KeyValueRow label={t('pt.profile.row_studio')} value={coach.studio} />
        <FP_KeyValueRow label={t('pt.profile.row_rate')} value={coach.rate} />
        <FP_KeyValueRow last label={t('pt.profile.row_since')} value={coach.since} />
      </FP_Card>

      <FP_PtSectionHead k="pt.profile.certifications" />
      <FP_Card style={styles.card}>
        {(coach.certs ?? []).map((cert, index, all) => (
          <FP_KeyValueRow
            key={cert.name}
            last={index === all.length - 1}
            label={cert.name}
            right={
              cert.verified ? (
                <FP_Badge tone="ok" label={t('pt.profile.badge_verified')} />
              ) : undefined
            }
          />
        ))}
      </FP_Card>

      <FP_PtSectionHead k="pt.profile.notifications" />
      <FP_Card style={styles.card}>
        {PREF_ROWS.map((row, index) => {
          const on = coach.prefs?.[row.key] ?? false;
          return (
            <FP_KeyValueRow
              key={row.key}
              last={index === PREF_ROWS.length - 1}
              label={t(row.label)}
              right={
                <FP_Chip
                  small
                  active={on}
                  label={t(on ? 'pt.profile.on' : 'pt.profile.off')}
                  onPress={() => void togglePref(row.key)}
                />
              }
            />
          );
        })}
      </FP_Card>

      <FP_PtSectionHead
        k="pt.profile.availability"
        actionKey="common.cta_edit"
        onAction={() => setSheet('availability-edit')}
      />
      <FP_Card style={styles.card} onPress={() => setSheet('availability')}>
        <FP_ListItem
          last
          style={styles.availabilityItem}
          title={summary[0] ?? t('pt.profile.availability_tap')}
          subtitle={summary.slice(1).join(' · ') || t('pt.profile.availability_tap')}
          right={<FP_Icon name="chevron-right" size={18} color={FP_COLORS.muted} />}
        />
      </FP_Card>

      <FP_Button
        variant="danger"
        style={styles.logout}
        title={t('profile.cta_logout')}
        onPress={() => void logout()}
      />

      <FP_BottomSheet visible={sheet !== null} onClose={() => setSheet(null)}>
        {sheet === 'coach' ? (
          <>
            <FP_PtSheetHead
              title={t('pt.profile.edit_title')}
              subtitle={t('pt.profile.edit_sub')}
            />
            <FP_Textbox
              label={t('pt.profile.name_label')}
              value={form.name}
              onChangeText={text => setForm(prev => ({ ...prev, name: text }))}
              error={formErrors.name ? t('pt.profile.err_name') : null}
              containerStyle={styles.sheetField}
            />
            <FP_Textbox
              label={t('pt.profile.title_label')}
              value={form.title}
              onChangeText={text => setForm(prev => ({ ...prev, title: text }))}
            />
            <FP_Textbox
              label={t('pt.profile.email_label')}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={text => setForm(prev => ({ ...prev, email: text }))}
              error={formErrors.email ? t('pt.profile.err_email') : null}
            />
            <FP_Textbox
              label={t('pt.profile.phone_label')}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={text => setForm(prev => ({ ...prev, phone: text }))}
            />
            <FP_Row gap={FP_SPACING.sm} align="flex-start" style={styles.sheetField}>
              <View style={styles.grow}>
                <FP_Textbox
                  placeholder={t('pt.profile.studio_ph')}
                  value={form.studio}
                  onChangeText={text => setForm(prev => ({ ...prev, studio: text }))}
                />
              </View>
              <View style={styles.grow}>
                <FP_Textbox
                  placeholder={t('pt.profile.rate_ph')}
                  value={form.rate}
                  onChangeText={text => setForm(prev => ({ ...prev, rate: text }))}
                />
              </View>
            </FP_Row>
            <FP_Button
              style={styles.sheetCta}
              loading={saving}
              title={t('common.cta_save')}
              onPress={() => void saveCoach()}
            />
          </>
        ) : sheet === 'availability' ? (
          <>
            <FP_PtSheetHead
              title={t('pt.profile.availability')}
              subtitle={t('pt.profile.availability_hint')}
              right={
                <FP_PtTextButton
                  k="common.cta_edit"
                  onPress={() => setSheet('availability-edit')}
                />
              }
            />
            <FP_Card style={styles.sheetField}>
              {availability.map((day, index) => (
                <FP_KeyValueRow
                  key={day.day}
                  last={index === availability.length - 1}
                  label={day.day}
                  muted={day.off}
                  value={day.off ? t('pt.profile.day_off') : `${day.from} – ${day.to}`}
                />
              ))}
            </FP_Card>
            <FP_Button
              style={styles.sheetCta}
              title={t('pt.profile.cta_edit_hours')}
              onPress={() => setSheet('availability-edit')}
            />
            <FP_Button
              style={styles.sheetCtaSecondary}
              variant="ghost"
              title={t('common.cta_close')}
              onPress={() => setSheet(null)}
            />
          </>
        ) : sheet === 'availability-edit' ? (
          <FP_PtAvailabilityEditor
            availability={availability}
            saving={saving}
            title={t('pt.profile.availability_edit_title')}
            subtitle={t('pt.profile.availability_edit_sub')}
            onToast={key => toast(t(key))}
            onSave={draft => void saveAvailability(draft)}
            onCancel={() => setSheet('availability')}
          />
        ) : null}
      </FP_BottomSheet>
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  block: { marginTop: FP_SPACING.md },
  statRow: { marginTop: FP_SPACING.lg },
  card: { marginTop: FP_SPACING.sm },
  availabilityItem: { paddingVertical: 0 },
  logout: { marginTop: FP_SPACING.xl },
  sheetField: { marginTop: FP_SPACING.lg },
  sheetCta: { marginTop: FP_SPACING.xl },
  sheetCtaSecondary: { marginTop: FP_SPACING.md },
  grow: { flex: 1 },
});

export { PtProfileScreen };
export default PtProfileScreen;
