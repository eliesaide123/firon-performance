/*
 * User administration — admin only (CONTRACT §5 `/api/users`, whose whole
 * surface is `requireRole('admin')`).
 *
 * Create, edit, activate/deactivate, reset a password and soft-delete. The
 * detail drawer shows whichever sub-document the role implies (`clientProfile`
 * or `trainerProfile`) and lets an admin move a client onto another trainer
 * through `POST /clients/:id/assign-trainer`, which emits `roster:updated` to
 * both coaches — the ['clients'] key root is invalidated by SocketContext.
 *
 * Forms pass `{ showAlert: false }` and read `err.fieldErrors` so validation
 * lands on the offending input instead of in a popup.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound, Pencil, Plus, ShieldAlert, Trash2, UserCog, UserPlus, Users as UsersIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, isFPError } from '@firon/shared';
import { LOCALES, ROLES } from '../lib/constants.js';
import { fmtAgo, fmtDate } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import { useAuth } from '../context/AuthContext.jsx';
import useDebounced from '../hooks/useDebounced.js';
import {
  FP_Avatar, FP_Badge, FP_Button, FP_Card, FP_CardHead, FP_ConfirmDialog, FP_Drawer,
  FP_EmptyState, FP_ErrorState, FP_IconButton, FP_KeyValueRow, FP_Modal, FP_Screen,
  FP_SearchInput, FP_Segmented, FP_Select, FP_SkeletonRows, FP_Switch, FP_Table,
  FP_Textbox, useToast,
} from '../components/index.ts';

const ROLE_TONE = { admin: 'danger', trainer: 'pt', client: 'muted' };

const EMPTY_CREATE = { name: '', email: '', phone: '', password: '', role: 'client', locale: 'en', trainerId: '' };

/** Only the fields `PUT /users/:id` accepts (the validator is `.strict()` and has no `role`). */
const editableOf = (user) => ({
  name: user?.name ?? '',
  email: user?.email ?? '',
  phone: user?.phone ?? '',
  locale: user?.locale ?? 'en',
  isVerified: Boolean(user?.isVerified),
  // Clients only. Kept in form state so the Edit modal can reassign a coach in place rather
  // than forcing the admin out to the detail drawer.
  trainerId: user?.clientProfile?.trainerId ?? '',
});

/** Read inline messages off an FPError, falling back to a form-level line. */
function inlineErrors(err) {
  if (isFPError(err) && err.fieldErrors && Object.keys(err.fieldErrors).length) {
    return { fields: err.fieldErrors, form: null };
  }
  return { fields: {}, form: err?.message ?? 'Something went wrong' };
}

/* ------------------------------ create form ----------------------------- */
function CreateUserForm({ open, onClose, onSave, saving, trainers, errors, formError }) {
  const [form, setForm] = useState(EMPTY_CREATE);
  const [localError, setLocalError] = useState(null);

  useEffect(() => { setForm(EMPTY_CREATE); setLocalError(null); }, [open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = () => {
    if (form.name.trim().length < 2) { setLocalError('Enter a full name'); return; }
    if (!form.email.trim()) { setLocalError('An email address is required'); return; }
    if (form.password.length < 6) { setLocalError('Password must be at least 6 characters'); return; }
    setLocalError(null);
    onSave({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password,
      role: form.role,
      locale: form.locale || undefined,
      ...(form.role === 'client' && form.trainerId
        ? { clientProfile: { trainerId: form.trainerId } }
        : {}),
    });
  };

  return (
    <FP_Modal
      open={open}
      onClose={onClose}
      title="New user"
      footer={(
        <>
          <FP_Button variant="secondary" onPress={onClose}>Cancel</FP_Button>
          <FP_Button loading={saving} icon={UserPlus} onPress={submit}>Create user</FP_Button>
        </>
      )}
    >
      <div className="grid grid--form">
        <FP_Textbox label="Full name" value={form.name} onChange={set('name')} error={errors.name} autoFocus />
        <FP_Textbox label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
        <FP_Textbox label="Phone" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="+961 70 123 456" />
        <FP_Textbox
          label="Temporary password"
          type="password"
          secure
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 6 characters — share it and ask them to change it"
        />
        <FP_Select label="Role" value={form.role} onChange={set('role')} options={ROLES} error={errors.role} />
        <FP_Select label="Locale" value={form.locale} onChange={set('locale')} options={LOCALES} />
        {form.role === 'client' ? (
          <FP_Select
            label="Assign to trainer"
            value={form.trainerId}
            onChange={set('trainerId')}
            options={trainers.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="No trainer yet"
            hint="A client with no trainer shows as a new request on the roster"
          />
        ) : null}
      </div>

      {localError || formError ? (
        <div className="errorbox mt3" role="alert">{localError ?? formError}</div>
      ) : null}
    </FP_Modal>
  );
}

/* ------------------------------- edit form ------------------------------ */
function EditUserForm({ open, onClose, onSave, saving, user, errors, formError, trainers = [] }) {
  const [form, setForm] = useState(() => editableOf(user));

  useEffect(() => { setForm(editableOf(user)); }, [user, open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const isClient = user?.role === 'client';
  const originalTrainerId = user?.clientProfile?.trainerId ?? '';
  const trainerChanged = isClient && form.trainerId !== originalTrainerId;

  return (
    <FP_Modal
      open={open}
      onClose={onClose}
      title={`Edit ${user?.name ?? 'user'}`}
      footer={(
        <>
          <FP_Button variant="secondary" onPress={onClose}>Cancel</FP_Button>
          <FP_Button
            loading={saving}
            onPress={() => onSave(
              {
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim() || null,
                locale: form.locale,
                isVerified: form.isVerified,
              },
              // Reassignment goes through POST /clients/:id/assign-trainer rather than the user
              // PUT, because only that endpoint emits roster:updated to both coaches and
              // notifies the new trainer.
              trainerChanged ? form.trainerId : undefined,
            )}
          >
            Save user
          </FP_Button>
        </>
      )}
    >
      <div className="grid grid--form">
        <FP_Textbox label="Full name" value={form.name} onChange={set('name')} error={errors.name} autoFocus />
        <FP_Textbox label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
        <FP_Textbox label="Phone" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <FP_Select label="Locale" value={form.locale} onChange={set('locale')} options={LOCALES} />
        {isClient ? (
          <FP_Select
            label="Assigned trainer"
            value={form.trainerId}
            onChange={set('trainerId')}
            options={trainers.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="No trainer — shows as a new request"
            hint={
              trainerChanged
                ? 'Saving moves this client onto the new roster and notifies that trainer'
                : 'Clients with no trainer appear as a new request on the roster'
            }
          />
        ) : null}
      </div>

      <div className="mt3">
        <FP_Switch
          checked={Boolean(form.isVerified)}
          onChange={(v) => setForm((f) => ({ ...f, isVerified: v }))}
          label={form.isVerified ? 'Verified — can sign in' : 'Unverified — must confirm the OTP first'}
        />
      </div>

      <div className="mt3 tiny muted">
        Role is fixed after creation ({user?.role ?? '—'}) — create a new account to change it.
      </div>

      {formError ? <div className="errorbox mt3" role="alert">{formError}</div> : null}
    </FP_Modal>
  );
}

/* ---------------------------- reset password ---------------------------- */
function ResetPasswordForm({ open, onClose, onSave, saving, user, errors, formError }) {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);

  useEffect(() => { setPassword(''); setLocalError(null); }, [open]);

  return (
    <FP_Modal
      open={open}
      onClose={onClose}
      title={`Reset password · ${user?.name ?? ''}`}
      footer={(
        <>
          <FP_Button variant="secondary" onPress={onClose}>Cancel</FP_Button>
          <FP_Button
            loading={saving}
            icon={KeyRound}
            onPress={() => {
              if (password.length < 6) { setLocalError('Password must be at least 6 characters'); return; }
              setLocalError(null);
              onSave({ password });
            }}
          >
            Reset password
          </FP_Button>
        </>
      )}
    >
      <FP_Textbox
        label="New password"
        type="password"
        secure
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        hint="Every existing session for this user is revoked"
        autoFocus
      />
      {localError || formError ? (
        <div className="errorbox mt3" role="alert">{localError ?? formError}</div>
      ) : null}
    </FP_Modal>
  );
}

/* ------------------------------ detail drawer ---------------------------- */
function UserDetail({ userId, trainers, onAssignTrainer, assigning }) {
  const [trainerId, setTrainerId] = useState('');

  const detailQuery = useQuery({
    queryKey: qk.user(userId),
    queryFn: () => api.users.byId(userId),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    setTrainerId(detailQuery.data?.clientProfile?.trainerId ?? '');
  }, [detailQuery.data]);

  if (detailQuery.isLoading) return <FP_SkeletonRows rows={8} height={18} />;
  if (detailQuery.isError) {
    return <FP_ErrorState error={detailQuery.error} onRetry={detailQuery.refetch} title="Could not load this user" />;
  }

  const user = detailQuery.data ?? {};
  const cp = user.clientProfile ?? {};
  const tp = user.trainerProfile ?? {};

  return (
    <>
      <FP_Card>
        <FP_CardHead
          title="Account"
          sub={`${user.role} · created ${fmtDate(user.createdAt)}`}
          actions={<FP_Badge tone={user.isActive ? 'ok' : 'danger'}>{user.isActive ? 'active' : 'deactivated'}</FP_Badge>}
        />
        <FP_KeyValueRow label="Email" value={user.email ?? '—'} />
        <FP_KeyValueRow label="Phone" value={user.phone ?? '—'} />
        <FP_KeyValueRow label="Locale" value={user.locale ?? 'en'} />
        <FP_KeyValueRow
          label="Verified"
          value={user.isVerified ? <FP_Badge tone="ok">yes</FP_Badge> : <FP_Badge tone="warn">no</FP_Badge>}
        />
        <FP_KeyValueRow label="Last login" value={user.lastLoginAt ? fmtAgo(user.lastLoginAt) : 'never'} />
        <FP_KeyValueRow label="Devices registered for push" value={user.fcmTokenCount ?? 0} />
      </FP_Card>

      {user.role === 'client' ? (
        <>
          <FP_Card className="mt4">
            <FP_CardHead title="Client profile" sub="The onboarding body stats and goals" />
            <FP_KeyValueRow label="Gender" value={cp.gender ?? '—'} />
            <FP_KeyValueRow label="Age" value={cp.age ?? '—'} />
            <FP_KeyValueRow label="Height" value={cp.heightCm ? `${cp.heightCm} cm` : '—'} />
            <FP_KeyValueRow label="Weight" value={cp.weightKg ? `${cp.weightKg} kg` : '—'} />
            <FP_KeyValueRow label="BMI" value={user.bmi ?? '—'} />
            <FP_KeyValueRow label="Body fat" value={cp.bodyFatPct ? `${cp.bodyFatPct}%` : '—'} />
            <FP_KeyValueRow label="Goal" value={cp.goal ?? '—'} />
            <FP_KeyValueRow label="Target weight" value={cp.targetWeightKg ? `${cp.targetWeightKg} kg` : '—'} />
            <FP_KeyValueRow label="Sessions / week" value={cp.sessionsPerWeek ?? '—'} />
            <FP_KeyValueRow label="Level" value={cp.level ?? '—'} />
            <FP_KeyValueRow label="Membership" value={cp.membershipLabel ?? '—'} />
            <FP_KeyValueRow
              label="Onboarding"
              value={cp.onboardingCompleted ? <FP_Badge tone="ok">complete</FP_Badge> : <FP_Badge tone="warn">incomplete</FP_Badge>}
            />
            <FP_KeyValueRow
              label="Active plans"
              value={[
                user.activePlans?.training ? `Training: ${user.activePlans.training.name}` : null,
                user.activePlans?.diet ? `Diet: ${user.activePlans.diet.name}` : null,
              ].filter(Boolean).join(' · ') || 'none'}
            />
          </FP_Card>

          <FP_Card className="mt4">
            <FP_CardHead
              title="Trainer"
              sub={user.trainer ? `${user.trainer.name} · ${user.trainer.email}` : 'Not assigned to a trainer yet'}
            />
            <div className="row mt3">
              <div className="grow">
                <FP_Select
                  label="Assign to trainer"
                  value={trainerId}
                  onChange={(e) => setTrainerId(e.target.value)}
                  options={trainers.map((t) => ({ value: t.id, label: `${t.name} · ${t.email}` }))}
                  placeholder="Pick a trainer"
                />
              </div>
              <FP_Button
                loading={assigning}
                disabled={!trainerId || trainerId === (user.clientProfile?.trainerId ?? '')}
                onPress={() => onAssignTrainer(user.id, trainerId)}
              >
                Assign
              </FP_Button>
            </div>
          </FP_Card>
        </>
      ) : null}

      {user.role === 'trainer' || user.role === 'admin' ? (
        <FP_Card className="mt4">
          <FP_CardHead title="Trainer profile" sub="Shown on the client's coach card in the app" />
          <FP_KeyValueRow label="Title" value={tp.title ?? '—'} />
          <FP_KeyValueRow label="Studio" value={tp.studio ?? '—'} />
          <FP_KeyValueRow label="Rate" value={tp.rate ?? '—'} />
          <FP_KeyValueRow label="Since" value={tp.since ?? '—'} />
          <FP_KeyValueRow
            label="Certifications"
            value={(tp.certs ?? []).length
              ? (tp.certs ?? []).map((c) => `${c.name}${c.verified ? ' ✓' : ''}`).join(', ')
              : 'none'}
          />
          <FP_KeyValueRow label="Open days" value={(tp.availability ?? []).filter((d) => !d.off).length} />
          <FP_KeyValueRow
            label="Notification prefs"
            value={Object.entries(tp.prefs ?? {}).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}
          />
        </FP_Card>
      ) : null}
    </>
  );
}

/* --------------------------------- page --------------------------------- */
export default function Users() {
  const { user: me, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [role, setRole] = useState('all');
  const [active, setActive] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const dSearch = useDebounced(search, 250);

  const params = useMemo(() => ({
    role: role === 'all' ? undefined : role,
    q: dSearch || undefined,
    isActive: active === 'all' ? undefined : active === 'active',
    page,
    limit: 25,
    sort: 'name',
  }), [role, dSearch, active, page]);

  const listQuery = useQuery({
    queryKey: qk.userList(params),
    queryFn: () => api.users.list(params),
    enabled: isAdmin,
  });

  const trainersQuery = useQuery({
    queryKey: qk.userList({ role: 'trainer', limit: 100, picker: true }),
    queryFn: () => api.users.list({ role: 'trainer', limit: 100, isActive: true }),
    enabled: isAdmin,
  });

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? null;
  const trainers = trainersQuery.data?.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.users });
    queryClient.invalidateQueries({ queryKey: qk.clients });
  };

  const clearErrors = () => { setErrors({}); setFormError(null); };

  /* Errors are rendered inline, so the proxy's popup is suppressed on writes
     that have a form behind them (CONTRACT §11.1 escape hatch). */
  const create = useMutation({
    mutationFn: (body) => api.users.create(body, { showAlert: false }),
    onMutate: clearErrors,
    onSuccess: (created) => {
      setCreating(false);
      toast.success(`${created.name} created`, { sub: `${created.role} · ${created.email}` });
      invalidate();
    },
    onError: (err) => { const e = inlineErrors(err); setErrors(e.fields); setFormError(e.form); },
  });

  const update = useMutation({
    mutationFn: ({ id, body }) => api.users.update(id, body, { showAlert: false }),
    onMutate: clearErrors,
    onSuccess: (saved) => { setEditing(null); toast.success(`${saved.name} saved`); invalidate(); },
    onError: (err) => { const e = inlineErrors(err); setErrors(e.fields); setFormError(e.form); },
  });

  const setActiveMutation = useMutation({
    mutationFn: (user) => api.users.setActive(user.id, { isActive: !user.isActive }),
    onSuccess: (saved) => {
      toast.success(`${saved.name} ${saved.isActive ? 'activated' : 'deactivated'}`);
      invalidate();
    },
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, body }) => api.users.resetPassword(id, body, { showAlert: false }),
    onMutate: clearErrors,
    onSuccess: () => { setResetting(null); toast.success('Password reset'); },
    onError: (err) => { const e = inlineErrors(err); setErrors(e.fields); setFormError(e.form); },
  });

  const remove = useMutation({
    mutationFn: (user) => api.users.remove(user.id),
    onSuccess: (res, user) => {
      setDeleting(null);
      setOpenId(null);
      toast.success(`${user.name} deleted`, { sub: res?.softDeleted ? 'Deactivated and sessions revoked' : undefined });
      invalidate();
    },
    onError: () => setDeleting(null),
  });

  /* The endpoint answers `{ clientId, trainerId, trainerName }` (not a User, despite
     the shared signature), and emits roster:updated to both coaches. */
  const assignTrainer = useMutation({
    mutationFn: ({ clientId, trainerId }) => api.clients.assignTrainer(clientId, { trainerId }),
    onSuccess: (res) => {
      toast.success(`Assigned to ${res?.trainerName ?? 'the trainer'}`, { sub: 'Their roster updated live' });
      invalidate();
    },
  });

  /* A trainer who lands here via a stale link gets a clear state, not a crash. */
  if (!isAdmin) {
    return (
      <FP_Screen title="Users">
        <FP_EmptyState
          icon={ShieldAlert}
          title="User administration is admin only"
          message={`Accounts are managed by an administrator. You are signed in as ${me?.role ?? 'a trainer'} — your clients live under "My clients".`}
        />
      </FP_Screen>
    );
  }

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <div className="row">
          <FP_Avatar name={u.name} src={u.avatarUrl} size="md" />
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 6 }}>
              <span className="strong truncate">{u.name}</span>
              {u.id === me?.id ? <FP_Badge tone="pt">you</FP_Badge> : null}
              {!u.isVerified ? <FP_Badge tone="warn">unverified</FP_Badge> : null}
            </div>
            <div className="tiny muted truncate who-cell">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: 100,
      render: (u) => <FP_Badge tone={ROLE_TONE[u.role] ?? 'muted'}>{u.role}</FP_Badge>,
    },
    {
      key: 'trainer',
      header: 'Trainer',
      width: 140,
      sortValue: (u) => u.trainer?.name ?? '',
      render: (u) => (u.role === 'client'
        ? <span className="truncate who-cell">{u.trainer?.name ?? <span className="tiny muted">unassigned</span>}</span>
        : <span className="tiny muted">—</span>),
    },
    {
      key: 'isActive',
      header: 'Active',
      width: 110,
      render: (u) => (
        <FP_Switch
          checked={Boolean(u.isActive)}
          disabled={u.id === me?.id}
          onChange={() => setActiveMutation.mutate(u)}
          label={u.isActive ? 'active' : 'off'}
        />
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last login',
      width: 120,
      render: (u) => <span className="tiny muted">{u.lastLoginAt ? fmtAgo(u.lastLoginAt) : 'never'}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 130,
      sortable: false,
      render: (u) => (
        <div className="row row--end">
          <FP_IconButton small icon={UserCog} label={`Open ${u.name}`} onPress={() => setOpenId(u.id)} />
          <FP_IconButton small icon={Pencil} label={`Edit ${u.name}`} onPress={() => { clearErrors(); setEditing(u); }} />
          <FP_IconButton small icon={KeyRound} label={`Reset password for ${u.name}`} onPress={() => { clearErrors(); setResetting(u); }} />
          <FP_IconButton
            small
            icon={Trash2}
            label={`Delete ${u.name}`}
            disabled={u.id === me?.id}
            onPress={() => setDeleting(u)}
          />
        </div>
      ),
    },
  ];

  return (
    <FP_Screen
      title="Users"
      subtitle="Every account on the platform · clients, trainers and admins"
      actions={<FP_Button icon={Plus} onPress={() => { clearErrors(); setCreating(true); }}>New user</FP_Button>}
    >
      <div className="toolbar">
        <div className="toolbar__grow">
          <FP_SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search name, email or phone…"
          />
        </div>
        <FP_Segmented
          value={role}
          onChange={(v) => { setRole(v); setPage(1); }}
          options={[{ value: 'all', label: 'All roles' }, ...ROLES.map((r) => ({ value: r, label: r }))]}
          aria-label="Filter by role"
        />
        <FP_Select
          value={active}
          onChange={(e) => { setActive(e.target.value); setPage(1); }}
          options={[
            { value: 'all', label: 'Active & inactive' },
            { value: 'active', label: 'Active only' },
            { value: 'inactive', label: 'Deactivated only' },
          ]}
          aria-label="Filter by activation"
        />
        <FP_Badge tone="muted">{meta?.total ?? rows.length} total</FP_Badge>
      </div>

      {listQuery.isError ? (
        <FP_ErrorState error={listQuery.error} onRetry={listQuery.refetch} title="Could not load users" />
      ) : null}

      <FP_Card flush>
        <FP_Table
          columns={columns}
          rows={rows}
          loading={listQuery.isLoading}
          serverPaged={Boolean(meta?.pages)}
          page={meta?.page ?? page}
          pages={meta?.pages ?? 1}
          total={meta?.total ?? rows.length}
          limit={meta?.limit}
          onPageChange={setPage}
          empty={(
            <FP_EmptyState
              icon={UsersIcon}
              title={search || role !== 'all' || active !== 'all' ? 'No users match' : 'No users yet'}
              message={search || role !== 'all' || active !== 'all'
                ? 'Try a different search or filter.'
                : 'Create the first account.'}
              action={<FP_Button icon={Plus} onPress={() => setCreating(true)}>New user</FP_Button>}
            />
          )}
        />
      </FP_Card>

      <CreateUserForm
        open={creating}
        trainers={trainers}
        saving={create.isPending}
        errors={errors}
        formError={formError}
        onClose={() => setCreating(false)}
        onSave={(body) => create.mutate(body)}
      />

      <EditUserForm
        open={Boolean(editing)}
        user={editing}
        trainers={trainers}
        saving={update.isPending || assignTrainer.isPending}
        errors={errors}
        formError={formError}
        onClose={() => setEditing(null)}
        onSave={(body, nextTrainerId) => {
          // Assigning a coach goes through POST /clients/:id/assign-trainer, because only that
          // endpoint emits roster:updated to the old and new coach and notifies the new one.
          // Clearing a coach cannot: that route requires a valid ObjectId, so an unassign is
          // folded into the user PUT as clientProfile.trainerId = null.
          const clearing = nextTrainerId === '';
          update.mutate({
            id: editing.id,
            body: clearing ? { ...body, clientProfile: { trainerId: null } } : body,
          });
          if (nextTrainerId !== undefined && !clearing) {
            assignTrainer.mutate({ clientId: editing.id, trainerId: nextTrainerId });
          }
        }}
      />

      <ResetPasswordForm
        open={Boolean(resetting)}
        user={resetting}
        saving={resetPassword.isPending}
        errors={errors}
        formError={formError}
        onClose={() => setResetting(null)}
        onSave={(body) => resetPassword.mutate({ id: resetting.id, body })}
      />

      <FP_ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting)}
        title="Delete user"
        confirmLabel="Delete user"
        danger
        message={`${deleting?.name ?? 'This user'} is soft-deleted: deactivated and every session revoked. Their plans and logs are kept.`}
      />

      <FP_Drawer
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        wide
        title={rows.find((u) => u.id === openId)?.name ?? 'User'}
        sub={rows.find((u) => u.id === openId)?.email}
        footer={<span className="tiny muted">Changes take effect on the user&apos;s next request</span>}
      >
        {openId ? (
          <UserDetail
            userId={openId}
            trainers={trainers}
            assigning={assignTrainer.isPending}
            onAssignTrainer={(clientId, trainerId) => assignTrainer.mutate({ clientId, trainerId })}
          />
        ) : null}
      </FP_Drawer>
    </FP_Screen>
  );
}
