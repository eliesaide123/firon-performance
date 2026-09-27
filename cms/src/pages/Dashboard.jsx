/*
 * CMS dashboard — GET /api/dashboard, kept live by `dashboard:tick` (which
 * invalidates ['dashboard'] via SocketContext.EVENT_MAP).
 */
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Bell, Dumbbell, Image as ImageIcon, RotateCw, Salad, Type, Users, Video,
} from 'lucide-react';
import {
  Bar, BarChart, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '@firon/shared';
import { fmtAgo, titleCase } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import { useSocket } from '../context/SocketContext.jsx';
import {
  FP_Button, FP_Card, FP_ChartCard, FP_EmptyState, FP_ErrorState,
  FP_Screen, FP_SkeletonCards, FP_StatCard,
} from '../components/index.ts';
import {
  FP_CHART, FP_STATUS_COLORS, fpAxisProps, fpTooltipProps,
} from '../components/fpChartTheme.ts';

export default function Dashboard() {
  const { connected } = useSocket();
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api.dashboard(),
    // `dashboard:tick` pushes updates; polling only covers a dead socket.
    refetchInterval: connected ? false : 60_000,
  });

  const users = data?.users ?? {};
  const content = data?.content ?? {};
  const media = data?.media ?? {};
  const videos = data?.videos ?? {};
  const plans = data?.plans ?? {};
  const activity = data?.recentActivity ?? [];

  /* DashboardStats.content.byGroup is Array<{group,count}> (CONTRACT types). */
  const byGroup = (Array.isArray(content.byGroup) ? content.byGroup : [])
    .map((g) => ({ name: titleCase(g.group), value: Number(g.count) || 0 }))
    .sort((a, b) => b.value - a.value);

  const mediaData = [
    { name: 'Approved', value: Number(media.approved) || 0, status: 'approved' },
    { name: 'Pending', value: Number(media.pending) || 0, status: 'pending' },
    { name: 'Rejected', value: Number(media.rejected) || 0, status: 'rejected' },
  ];

  const planData = [
    { name: 'Training', value: Number(plans.activeTraining) || 0 },
    { name: 'Diet', value: Number(plans.activeDiet) || 0 },
  ];

  return (
    <FP_Screen
      title="Dashboard"
      subtitle={(
        <>
          Live snapshot of everything the mobile app reads
          {dataUpdatedAt ? ` · updated ${fmtAgo(dataUpdatedAt)}` : ''}
          {connected ? ' · streaming via dashboard:tick' : ' · socket offline, polling'}
        </>
      )}
      actions={(
        <FP_Button variant="secondary" icon={RotateCw} loading={isFetching} onPress={() => refetch()}>
          Refresh
        </FP_Button>
      )}
    >
      {isError ? <FP_ErrorState error={error} onRetry={refetch} title="Dashboard unavailable" /> : null}
      {isLoading ? <FP_SkeletonCards count={6} /> : null}

      {!isLoading && !isError ? (
        <>
          <div className="grid grid--stats">
            <FP_StatCard
              label="Clients"
              value={users.clients ?? 0}
              icon={Users}
              hint={`${users.trainers ?? 0} trainers · ${users.admins ?? 0} admins`}
            />
            <FP_StatCard
              label="Content keys"
              value={content.total ?? 0}
              icon={Type}
              hint={`${byGroup.length} groups`}
            />
            <FP_StatCard
              label="Media pending"
              value={media.pending ?? 0}
              icon={ImageIcon}
              tone={media.pending ? 'warn' : undefined}
              hint={`${media.approved ?? 0} approved`}
            />
            <FP_StatCard
              label="Videos published"
              value={videos.published ?? 0}
              icon={Video}
              hint={videos.total != null ? `${videos.total} total` : undefined}
            />
            <FP_StatCard label="Active training plans" value={plans.activeTraining ?? 0} icon={Activity} />
            <FP_StatCard label="Active diet plans" value={plans.activeDiet ?? 0} icon={Salad} />
          </div>

          <div className="grid grid--2 mt4">
            <FP_ChartCard
              title="Content keys by group"
              sub="How much of the app each group drives"
              data={byGroup}
              valueLabel="Keys"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byGroup}
                  layout="vertical"
                  margin={{ top: 4, right: 30, bottom: 4, left: 8 }}
                  barCategoryGap={6}
                >
                  <XAxis type="number" {...fpAxisProps} />
                  <YAxis type="category" dataKey="name" width={86} {...fpAxisProps} />
                  <Tooltip {...fpTooltipProps} />
                  <Bar dataKey="value" name="Keys" fill={FP_CHART.single} radius={[0, 4, 4, 0]} maxBarSize={14}>
                    <LabelList dataKey="value" position="right" fill={FP_CHART.axis} fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </FP_ChartCard>

            <FP_ChartCard
              title="Media review queue"
              sub="Reserved status colours · labelled, never colour alone"
              data={mediaData}
              valueLabel="Assets"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mediaData} margin={{ top: 18, right: 12, bottom: 4, left: 0 }} barCategoryGap={18}>
                  <XAxis dataKey="name" {...fpAxisProps} />
                  <YAxis {...fpAxisProps} allowDecimals={false} />
                  <Tooltip {...fpTooltipProps} />
                  <Legend wrapperStyle={{ fontSize: 11, color: FP_CHART.axis }} />
                  <Bar dataKey="value" name="Assets" radius={[4, 4, 0, 0]} maxBarSize={44}>
                    {mediaData.map((d) => <Cell key={d.status} fill={FP_STATUS_COLORS[d.status]} />)}
                    <LabelList dataKey="value" position="top" fill={FP_CHART.axis} fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </FP_ChartCard>

            <FP_ChartCard title="Active plans" sub="Assigned and currently running" data={planData} valueLabel="Plans">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planData} margin={{ top: 18, right: 12, bottom: 4, left: 0 }} barCategoryGap={26}>
                  <XAxis dataKey="name" {...fpAxisProps} />
                  <YAxis {...fpAxisProps} allowDecimals={false} />
                  <Tooltip {...fpTooltipProps} />
                  <Bar dataKey="value" name="Plans" fill={FP_CHART.singleAlt} radius={[4, 4, 0, 0]} maxBarSize={44}>
                    <LabelList dataKey="value" position="top" fill={FP_CHART.axis} fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </FP_ChartCard>

            <FP_Card>
              <div className="row between">
                <div>
                  <div className="card__title">Recent activity</div>
                  <div className="card__sub">Audit trail across the platform</div>
                </div>
                <Link to="/notifications" className="chip"><Bell size={13} /> Notifications</Link>
              </div>
              <div className="mt3 activity-scroll">
                {activity.length ? activity.map((a, i) => (
                  <div className="activity" key={a.id ?? `${a.label}-${i}`}>
                    <span className="activity__dot" />
                    <div className="grow">
                      <div className="strong">{a.label ?? a.action ?? 'change'}</div>
                      {a.actor ? <div className="tiny muted">{a.actor}</div> : null}
                    </div>
                    <span className="tiny muted nowrap">{fmtAgo(a.at ?? a.createdAt)}</span>
                  </div>
                )) : (
                  <FP_EmptyState
                    icon={Dumbbell}
                    title="No activity yet"
                    message="Edits and approvals will show up here."
                  />
                )}
              </div>
            </FP_Card>
          </div>
        </>
      ) : null}
    </FP_Screen>
  );
}
