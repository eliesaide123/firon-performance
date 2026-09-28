/*
 * Client roster (CONTRACT §5 `/api/clients`).
 *
 * A trainer sees their own roster; an admin sees every client. The stat row is
 * `GET /clients/stats`, the table is `GET /clients`, and a row press opens the
 * detail drawer (`GET /clients/:id`) with the client's stats, active training
 * plan, active diet plan and most recent logs.
 *
 * Live: `roster:updated`, `plan:assigned`, `plan:progress`, `session:completed`
 * and `client:log` all invalidate the ['clients'] key root in SocketContext, so
 * the adherence numbers move while a client trains. `useSocketEvent` is layered
 * on top only to flash the row that just changed.
 */
import { useQuery } from '@tanstack/react-query';
import {
  Activity, CalendarCheck, Dumbbell, Salad, Sparkles, TrendingUp, UserSquare2, Users,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FP_SOCKET_EVENTS, api, fpAdherenceColor } from '@firon/shared';
import { adherenceTone, fmtAgo, fmtDate, fmtNumber } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketEvent } from '../context/SocketContext.jsx';
import useDebounced from '../hooks/useDebounced.js';
import {
  FP_Avatar, FP_Badge, FP_Button, FP_Card, FP_CardHead, FP_Drawer, FP_EmptyState,
  FP_ErrorState, FP_KeyValueRow, FP_ProgressBar, FP_Screen, FP_SearchInput,
  FP_Segmented, FP_SkeletonCards, FP_SkeletonRows, FP_StatCard, FP_Table,
} from '../components/index.ts';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ok', label: 'On track' },
  { value: 'warn', label: 'Needs attention' },
  { value: 'new', label: 'New' },
];

/** The roster's `status` maps to the prototype's badges. */
const STATUS_BADGE = {
  ok: { tone: 'ok', label: 'On track' },
  warn: { tone: 'warn', label: 'Needs attention' },
  new: { tone: 'pt', label: 'New' },
};

function Adherence({ pct }) {
  const value = Number(pct) || 0;
  return (
    <div className="row" style={{ gap: 8 }}>
      <span className="adherence" style={{ color: fpAdherenceColor(value) }}>{value}%</span>
      <div style={{ width: 62 }}>
        <FP_ProgressBar
          value={value}
          tone={adherenceTone(value) === 'ok' ? undefined : (adherenceTone(value) === 'warn' ? 'warn' : 'bad')}
        />
      </div>
    </div>
  );
}

/** The drawer body: one query per opened client. */
function ClientDetail({ clientId, onBuildTraining, onBuildDiet }) {
  const detailQuery = useQuery({
    queryKey: qk.client(clientId),
    queryFn: () => api.clients.byId(clientId),
    enabled: Boolean(clientId),
  });

  if (detailQuery.isLoading) return <FP_SkeletonRows rows={9} height={18} />;
  if (detailQuery.isError) {
    return <FP_ErrorState error={detailQuery.error} onRetry={detailQuery.refetch} title="Could not load this client" />;
  }

  const detail = detailQuery.data ?? {};
  const client = detail.client ?? {};
  const stats = detail.stats ?? {};
  const profile = client.clientProfile ?? {};
  const training = detail.trainingPlan;
  const diet = detail.dietPlan;
  const logs = detail.recentLogs ?? [];
  const adherence = Number(stats.adherencePct ?? 0);

  return (
    <>
      <div className="grid grid--stats">
        <FP_StatCard
          label="Adherence"
          value={`${adherence}%`}
          icon={TrendingUp}
          tone={adherenceTone(adherence) === 'ok' ? 'accent' : (adherenceTone(adherence) === 'warn' ? 'warn' : 'danger')}
          hint={`${stats.daysDone ?? 0} / ${stats.daysTotal ?? 0} days done`}
        />
        <FP_StatCard
          label="Sessions done"
          value={fmtNumber(stats.sessionsCompleted ?? 0)}
          icon={CalendarCheck}
          hint={`${stats.sessionsThisWeek ?? 0} this week · target ${stats.weeklyTarget ?? profile.sessionsPerWeek ?? 0}/wk`}
        />
        <FP_StatCard
          label="Weight change"
          value={`${(stats.weightChangeKg ?? 0) > 0 ? '+' : ''}${stats.weightChangeKg ?? 0} kg`}
          icon={Activity}
          hint={profile.targetWeightKg ? `target ${profile.targetWeightKg} kg` : undefined}
        />
      </div>

      <FP_Card className="mt4">
        <FP_CardHead title="Profile" sub={`Last active ${fmtAgo(stats.lastActive)}`} />
        <FP_KeyValueRow label="Email" value={client.email ?? '—'} />
        <FP_KeyValueRow label="Phone" value={client.phone ?? '—'} />
        <FP_KeyValueRow label="Goal" value={profile.goal ?? '—'} />
        <FP_KeyValueRow label="Level" value={profile.level ?? '—'} />
        <FP_KeyValueRow label="Membership" value={profile.membershipLabel ?? '—'} />
        <FP_KeyValueRow
          label="Body"
          value={profile.heightCm
            ? `${profile.heightCm} cm · ${profile.weightKg ?? '—'} kg${client.bmi ? ` · BMI ${client.bmi}` : ''}`
            : '—'}
        />
        <FP_KeyValueRow
          label="Onboarding"
          value={profile.onboardingCompleted
            ? <FP_Badge tone="ok">complete</FP_Badge>
            : <FP_Badge tone="warn">incomplete</FP_Badge>}
        />
      </FP_Card>

      <FP_Card className="mt4">
        <FP_CardHead
          title="Current training plan"
          sub={training ? `${training.name} · week ${training.weekNumber ?? '—'} · ${training.status}` : 'No active plan'}
          actions={<FP_Button size="sm" variant="secondary" icon={Dumbbell} onPress={onBuildTraining}>Open builder</FP_Button>}
        />
        {training ? (
          <div className="col mt3">
            {(training.days ?? []).map((day, i) => (
              <div className="day-card" key={day._id ?? `${day.dayIndex}-${i}`}>
                <div className="day-card__head">
                  <FP_Badge tone={day.status === 'done' ? 'ok' : (day.status === 'now' ? 'pt' : 'muted')}>
                    {day.dayLabel ?? `Day ${day.dayIndex + 1}`}
                  </FP_Badge>
                  <div className="grow strong truncate">{day.title}</div>
                  <span className="tiny muted nowrap">
                    {day.doneCount ?? 0}/{day.total ?? (day.exercises ?? []).length} · {day.durationMin ?? 0} min
                  </span>
                </div>
                <div className="mt2">
                  {(day.exercises ?? []).map((ex, j) => (
                    <div className="ex-row" key={ex._id ?? `${ex.name}-${j}`}>
                      <span className={`ex-row__name ${ex.done ? 'done-text' : ''}`}>{ex.name}</span>
                      <span className="tiny muted nowrap">{ex.prescription || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <FP_EmptyState
            icon={Dumbbell}
            title="No training plan assigned"
            message="Build one in the training builder — assigning it reaches the client's phone instantly."
          />
        )}
      </FP_Card>

      <FP_Card className="mt4">
        <FP_CardHead
          title="Current diet plan"
          sub={diet ? `${diet.name} · ${diet.status}` : 'No active plan'}
          actions={<FP_Button size="sm" variant="secondary" icon={Salad} onPress={onBuildDiet}>Open builder</FP_Button>}
        />
        {diet ? (
          <>
            <div className="row row--wrap mt3">
              <FP_Badge tone="pt">{diet.totalKcal ?? diet.totals?.kcal ?? 0} / {diet.kcal ?? 0} kcal</FP_Badge>
              <FP_Badge tone="muted">P {diet.protein ?? 0}g</FP_Badge>
              <FP_Badge tone="muted">C {diet.carbs ?? 0}g</FP_Badge>
              <FP_Badge tone="muted">F {diet.fat ?? 0}g</FP_Badge>
            </div>
            <div className="mt3">
              {(diet.meals ?? []).map((meal, i) => (
                <FP_KeyValueRow
                  key={meal._id ?? `${meal.slot}-${i}`}
                  label={`${meal.slot} — ${meal.food}`}
                  value={`${meal.kcal ?? 0} kcal`}
                />
              ))}
            </div>
          </>
        ) : (
          <FP_EmptyState icon={Salad} title="No diet plan assigned" message="Set kcal and macro targets in the diet builder." />
        )}
      </FP_Card>

      <FP_Card className="mt4">
        <FP_CardHead title="Recent logs" sub="Workout and meal entries the client submitted" />
        {logs.length ? (
          <div className="mt3">
            {logs.map((logEntry, i) => (
              <div className="activity" key={logEntry.id ?? i}>
                <span className="activity__dot" />
                <div className="grow">
                  <div className="strong truncate">
                    {logEntry.exerciseName ?? logEntry.food ?? logEntry.title ?? 'Log entry'}
                  </div>
                  <div className="tiny muted">
                    {logEntry.exerciseName
                      ? [
                        logEntry.sets ? `${logEntry.sets} × ${logEntry.reps ?? '—'}` : null,
                        logEntry.weightKg ? `${logEntry.weightKg} kg` : null,
                        logEntry.durationMin ? `${logEntry.durationMin} min` : null,
                      ].filter(Boolean).join(' · ') || 'workout'
                      : [logEntry.slot, logEntry.kcal ? `${logEntry.kcal} kcal` : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="tiny muted nowrap">{logEntry.date ? fmtDate(logEntry.date) : fmtAgo(logEntry.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <FP_EmptyState icon={Sparkles} title="No logs yet" message="Check-offs and meal logs from the app land here." />
        )}
      </FP_Card>
    </>
  );
}

export default function Clients() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [flashed, setFlashed] = useState({});
  const dSearch = useDebounced(search, 250);

  const params = useMemo(
    () => ({ q: dSearch || undefined, status: status === 'all' ? undefined : status, limit: 200 }),
    [dSearch, status],
  );

  const statsQuery = useQuery({ queryKey: qk.clientStats, queryFn: () => api.clients.stats() });
  const rosterQuery = useQuery({ queryKey: qk.clientList(params), queryFn: () => api.clients.roster(params) });

  const roster = rosterQuery.data ?? [];
  const stats = statsQuery.data ?? {};
  const openRow = roster.find((c) => c.id === openId) ?? null;

  /* Flash the row a live event just touched, on top of the query invalidation. */
  const flash = useCallback((clientId) => {
    if (!clientId) return;
    setFlashed((f) => ({ ...f, [clientId]: true }));
    setTimeout(() => setFlashed((f) => { const next = { ...f }; delete next[clientId]; return next; }), 2400);
  }, []);

  useSocketEvent(FP_SOCKET_EVENTS.PLAN_PROGRESS, (payload) => flash(payload?.clientId));
  useSocketEvent(FP_SOCKET_EVENTS.SESSION_COMPLETED, (payload) => flash(payload?.clientId));
  useSocketEvent(FP_SOCKET_EVENTS.CLIENT_LOG, (payload) => flash(payload?.clientId));

  const columns = [
    {
      key: 'name',
      header: 'Client',
      render: (c) => (
        <div className="row">
          <FP_Avatar name={c.name} src={c.avatarUrl} size="md" />
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 6 }}>
              <span className="strong truncate">{c.name}</span>
              {c.status === 'new' ? <FP_Badge tone="pt">New</FP_Badge> : null}
            </div>
            <div className="tiny muted truncate who-cell">{c.email ?? '—'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'planLabel',
      header: 'Training plan',
      width: 170,
      render: (c) => (
        <div>
          <div className="truncate">{c.planLabel}</div>
          <div className="tiny muted">{c.goal ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'dietPlanSummary',
      header: 'Diet plan',
      width: 160,
      sortValue: (c) => c.dietPlanSummary?.name ?? '',
      render: (c) => (c.dietPlanSummary ? (
        <div>
          <div className="truncate">{c.dietPlanSummary.name}</div>
          <div className="tiny muted">
            {c.dietPlanSummary.kcal} kcal · {c.dietPlanSummary.meals ?? c.dietPlanSummary.mealCount ?? 0} meals
          </div>
        </div>
      ) : <span className="tiny muted">none</span>),
    },
    {
      key: 'adherencePct',
      header: 'Adherence',
      width: 150,
      render: (c) => <Adherence pct={c.adherencePct} />,
    },
    {
      key: 'status',
      header: 'Status',
      width: 140,
      render: (c) => {
        const badge = STATUS_BADGE[c.status] ?? { tone: 'muted', label: c.status };
        return <FP_Badge tone={badge.tone}>{badge.label}</FP_Badge>;
      },
    },
    {
      key: 'membershipLabel',
      header: 'Membership',
      width: 120,
      render: (c) => <span className="tiny muted">{c.membershipLabel ?? '—'}</span>,
    },
  ];

  return (
    <FP_Screen
      title={isAdmin ? 'Clients' : 'My clients'}
      subtitle={isAdmin
        ? 'Every client on the platform · press a row for plans, stats and logs'
        : 'Your roster · adherence updates live as clients check exercises off'}
      actions={(
        <FP_Button variant="secondary" icon={Activity} onPress={() => navigate('/plans/training')}>
          Training builder
        </FP_Button>
      )}
    >
      {statsQuery.isLoading ? <FP_SkeletonCards count={4} /> : null}
      {statsQuery.isError ? (
        <FP_ErrorState error={statsQuery.error} onRetry={statsQuery.refetch} title="Could not load roster stats" />
      ) : null}
      {!statsQuery.isLoading && !statsQuery.isError ? (
        <div className="grid grid--stats">
          <FP_StatCard
            label="Active clients"
            value={fmtNumber(stats.activeClients ?? 0)}
            icon={Users}
            hint={stats.totalClients != null ? `${stats.totalClients} total` : undefined}
          />
          <FP_StatCard label="Sessions this week" value={fmtNumber(stats.sessionsThisWeek ?? 0)} icon={CalendarCheck} />
          <FP_StatCard
            label="New requests"
            value={fmtNumber(stats.newRequests ?? 0)}
            icon={Sparkles}
            tone={stats.newRequests ? 'warn' : undefined}
            hint="Clients without an active plan"
          />
          <FP_StatCard
            label="Avg adherence"
            value={`${stats.avgAdherence ?? 0}%`}
            icon={TrendingUp}
            tone={adherenceTone(stats.avgAdherence ?? 0) === 'ok' ? 'accent' : (adherenceTone(stats.avgAdherence ?? 0) === 'warn' ? 'warn' : 'danger')}
          />
        </div>
      ) : null}

      <div className="toolbar mt4">
        <div className="toolbar__grow">
          <FP_SearchInput value={search} onChange={setSearch} placeholder="Search name, email or phone…" />
        </div>
        <FP_Segmented value={status} onChange={setStatus} options={STATUS_FILTERS} aria-label="Filter by status" />
        <FP_Badge tone="muted">{roster.length} shown</FP_Badge>
      </div>

      {rosterQuery.isError ? (
        <FP_ErrorState error={rosterQuery.error} onRetry={rosterQuery.refetch} title="Could not load the roster" />
      ) : null}

      <FP_Card flush>
        <FP_Table
          columns={columns}
          rows={roster}
          loading={rosterQuery.isLoading}
          onRowPress={(c) => setOpenId(c.id)}
          rowClassName={(c) => (flashed[c.id] ? 'row-flash' : undefined)}
          initialSort={{ key: 'name', dir: 'asc' }}
          pageSize={50}
          empty={(
            <FP_EmptyState
              icon={UserSquare2}
              title={search || status !== 'all' ? 'No clients match' : 'No clients yet'}
              message={search || status !== 'all'
                ? 'Try a different search or status filter.'
                : 'Clients appear here once they register and are assigned to a trainer.'}
            />
          )}
        />
      </FP_Card>

      <FP_Drawer
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        wide
        title={openRow?.name ?? 'Client'}
        sub={openRow ? `${openRow.planLabel} · ${openRow.adherencePct}% adherence` : undefined}
      >
        {openId ? (
          <ClientDetail
            clientId={openId}
            onBuildTraining={() => { setOpenId(null); navigate(`/plans/training?clientId=${openId}`); }}
            onBuildDiet={() => { setOpenId(null); navigate(`/plans/diet?clientId=${openId}`); }}
          />
        ) : null}
      </FP_Drawer>
    </FP_Screen>
  );
}
