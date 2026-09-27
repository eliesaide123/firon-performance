/**
 * PT tab 1 — the prototype's `pt-roster` screen plus its `clientSheet()`.
 *
 * Header (coach avatar + "Trainer portal" / "Coach {first}") -> three stat cards from
 * `GET /clients/stats` -> the roster from `GET /clients`. Tapping a card opens the client
 * sheet, which pulls the detail from `GET /clients/:id` and hands off to the Plans builder.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, type ClientDetail, type RosterEntry, type TrainerStats } from '@firon/shared';
import {
  FP_AppHeader,
  FP_Avatar,
  FP_Badge,
  FP_Button,
  FP_BottomSheet,
  FP_Card,
  FP_CmsText,
  FP_EmptyState,
  FP_ErrorState,
  FP_Icon,
  FP_KeyValueRow,
  FP_ListItem,
  FP_Row,
  FP_Screen,
  FP_Skeleton,
  FP_StatCard,
} from '../../components';
import { useAuth } from '../../auth/AuthProvider';
import { useContent } from '../../cms/ContentProvider';
import useResource from '../../store/useResource';
import { QK } from '../../store/queryCache';
import { FP_COLORS, FP_SPACING } from '../../theme';
import FP_PtAdherence from './components/FP_PtAdherence';
import FP_PtSectionHead from './components/FP_PtSectionHead';
import FP_PtSheetHead from './components/FP_PtSheetHead';
import { fpDash, fpFirstName, fpGroupNumber, fpLastActive, fpWeightDelta } from './ptUtils';

/**
 * The server sends `meals` (a count) and an `id` where the shared DTO names `mealCount`.
 * Widened rather than re-declared so the shared type stays the single source of truth.
 */
type RosterDietSummary = NonNullable<RosterEntry['dietPlanSummary']> & {
  id?: string;
  meals?: number;
};

/** `GET /clients/:id` returns richer week/session counters than the shared DTO spells out. */
type ClientDetailStats = ClientDetail['stats'] &
  Partial<{
    weekNumber: number;
    sessionsThisWeek: number;
    weeklyTarget: number;
    daysDone: number;
    daysTotal: number;
  }>;

type PtNav = { navigate: (screen: string, params?: Record<string, unknown>) => void };

export interface ClientsScreenProps {
  /** Injected by the navigator; kept loose so this screen never imports the nav param list. */
  navigation?: PtNav;
}

const ClientsScreen: React.FC<ClientsScreenProps> = ({ navigation }) => {
  const { t } = useContent();
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  const roster = useResource<RosterEntry[]>(QK.roster, () => api.clients.roster());
  const stats = useResource<TrainerStats>(QK.clientStats, () => api.clients.stats());
  const detail = useResource<ClientDetail>(
    QK.clientDetail(openId ?? 'none'),
    () => api.clients.byId(openId as string),
    { enabled: Boolean(openId) },
  );

  const entries = roster.data ?? [];
  const open = useMemo(() => entries.find(c => c.id === openId) ?? null, [entries, openId]);

  const refresh = useCallback(async () => {
    await Promise.all([roster.refresh(), stats.refresh()]);
  }, [roster, stats]);

  const goToBuilder = useCallback(
    (kind: 'train' | 'diet') => {
      if (!open) {
        return;
      }
      setOpenId(null);
      navigation?.navigate('Plans', { clientId: open.id, kind });
    },
    [navigation, open],
  );

  const header = (
    <FP_AppHeader
      left={<FP_Avatar name={user?.name ?? ''} size={44} />}
      eyebrow={t('pt.roster.portal_label')}
      title={t('pt.roster.coach_prefix', { first: fpFirstName(user?.name) })}
    />
  );

  const detailStats = (detail.data?.stats ?? null) as ClientDetailStats | null;
  const diet = (open?.dietPlanSummary ?? null) as RosterDietSummary | null;
  const sheetDiet = detail.data?.dietPlan ?? null;
  const dietName = sheetDiet?.name ?? diet?.name ?? null;
  const dietKcal = sheetDiet?.kcal ?? diet?.kcal ?? 0;
  const dietMeals = sheetDiet?.meals?.length ?? diet?.meals ?? diet?.mealCount ?? 0;

  return (
    <FP_Screen onRefresh={refresh} refreshing={roster.loading && !roster.initialLoading}>
      {header}
      {stats.initialLoading ? (
        <FP_Row style={styles.statRow} gap={10}>
          <FP_Skeleton height={64} style={styles.grow} />
          <FP_Skeleton height={64} style={styles.grow} />
          <FP_Skeleton height={64} style={styles.grow} />
        </FP_Row>
      ) : (
        <FP_Row style={styles.statRow} gap={10} align="stretch">
          <FP_StatCard
            accent
            value={String(stats.data?.activeClients ?? 0)}
            label={t('pt.roster.stat_clients')}
          />
          <FP_StatCard
            value={String(stats.data?.sessionsThisWeek ?? 0)}
            label={t('pt.roster.stat_sessions')}
          />
          <FP_StatCard
            value={String(stats.data?.newRequests ?? 0)}
            label={t('pt.roster.stat_requests')}
          />
        </FP_Row>
      )}

      <FP_PtSectionHead k="pt.roster.roster_title" large />

      {roster.error ? (
        <FP_ErrorState
          title={t('common.error_generic')}
          message={roster.error.message}
          retryLabel={t('common.retry')}
          onRetry={roster.refresh}
          style={styles.block}
        />
      ) : roster.initialLoading ? (
        <View style={styles.block}>
          <FP_Skeleton height={78} style={styles.rosterSkeleton} />
          <FP_Skeleton height={78} style={styles.rosterSkeleton} />
          <FP_Skeleton height={78} style={styles.rosterSkeleton} />
        </View>
      ) : entries.length === 0 ? (
        <FP_EmptyState
          title={t('pt.roster.empty')}
          icon={<FP_Icon name="users" size={26} color={FP_COLORS.muted} />}
          style={styles.block}
        />
      ) : (
        <View style={styles.block}>
          {entries.map(c => (
            <FP_Card key={c.id} style={styles.rosterCard} onPress={() => setOpenId(c.id)}>
              <FP_ListItem
                last
                style={styles.rosterItem}
                left={<FP_Avatar name={c.name} size={44} />}
                title={c.name}
                subtitle={c.planLabel}
                right={
                  c.status === 'new' ? (
                    <FP_Badge tone="warn" label={t('pt.roster.badge_new')} />
                  ) : (
                    <FP_PtAdherence pct={c.adherencePct} />
                  )
                }
              />
            </FP_Card>
          ))}
        </View>
      )}

      <FP_BottomSheet visible={Boolean(open)} onClose={() => setOpenId(null)}>
        {open ? (
          <>
            <FP_PtSheetHead title={open.name} subtitle={open.planLabel} />

            <FP_Row style={styles.sheetStats} gap={10} align="stretch">
              <FP_StatCard
                accent
                dense
                value={`${Math.round(detailStats?.adherencePct ?? open.adherencePct)}%`}
                label={t('pt.roster.sheet_adherence')}
              />
              <FP_StatCard
                dense
                value={`Wk ${detailStats?.weekNumber ?? detail.data?.trainingPlan?.weekNumber ?? 1}`}
                label={t('pt.roster.sheet_program')}
              />
              <FP_StatCard
                dense
                value={`${detailStats?.sessionsThisWeek ?? detailStats?.daysDone ?? 0}/${
                  detailStats?.weeklyTarget ?? detailStats?.daysTotal ?? 0
                }`}
                label={t('pt.roster.sheet_this_week')}
              />
            </FP_Row>

            <FP_PtSectionHead k="pt.roster.sheet_progress" />
            <FP_Card style={styles.sheetCard}>
              {detail.initialLoading ? (
                <FP_Skeleton height={96} />
              ) : (
                <>
                  <FP_KeyValueRow
                    label={t('pt.roster.sheet_sessions_done')}
                    value={fpDash(detailStats?.sessionsCompleted)}
                  />
                  <FP_KeyValueRow
                    label={t('pt.roster.sheet_weight_change')}
                    value={fpWeightDelta(detailStats?.weightChangeKg)}
                    valueColor={FP_COLORS.accent}
                  />
                  <FP_KeyValueRow
                    last
                    label={t('pt.roster.sheet_last_active')}
                    value={fpLastActive(detailStats?.lastActive)}
                  />
                </>
              )}
            </FP_Card>

            <FP_PtSectionHead k="pt.roster.sheet_diet" />
            <FP_Card style={styles.sheetCard}>
              <FP_KeyValueRow
                label={t('pt.roster.sheet_plan')}
                value={dietName ?? t('pt.roster.sheet_not_assigned')}
                muted={!dietName}
              />
              <FP_KeyValueRow
                label={t('pt.roster.sheet_daily_target')}
                value={`${fpGroupNumber(dietKcal)} kcal`}
              />
              <FP_KeyValueRow
                label={t('pt.roster.sheet_macros')}
                value={`P ${sheetDiet?.protein ?? diet?.protein ?? 0}g · C ${
                  sheetDiet?.carbs ?? diet?.carbs ?? 0
                }g · F ${sheetDiet?.fat ?? diet?.fat ?? 0}g`}
              />
              <FP_KeyValueRow last label={t('pt.roster.sheet_meals')} value={String(dietMeals)} />
            </FP_Card>

            <FP_Button
              title={t('pt.roster.cta_edit_train')}
              onPress={() => goToBuilder('train')}
              style={styles.sheetCta}
            />
            <FP_Button
              variant="ghost"
              title={t('pt.roster.cta_edit_diet')}
              onPress={() => goToBuilder('diet')}
              style={styles.sheetCtaSecondary}
            />
          </>
        ) : null}
      </FP_BottomSheet>
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  statRow: { marginTop: FP_SPACING.md },
  grow: { flex: 1 },
  block: { marginTop: FP_SPACING.sm },
  rosterSkeleton: { marginTop: FP_SPACING.md },
  rosterCard: { marginTop: FP_SPACING.md },
  rosterItem: { paddingVertical: 0 },
  sheetStats: { marginTop: FP_SPACING.lg },
  sheetCard: { marginTop: FP_SPACING.sm },
  sheetCta: { marginTop: FP_SPACING.xl },
  sheetCtaSecondary: { marginTop: FP_SPACING.md },
});

export default ClientsScreen;
