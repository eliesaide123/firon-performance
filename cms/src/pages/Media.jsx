/*
 * Media library + admin approval queue.
 *
 * Admins see everything (GET /api/media) and can approve / reject / delete.
 * Trainers see only their own uploads (GET /api/media/mine). New trainer
 * uploads arrive live through `media:pending` and status changes through
 * `media:status` — both invalidate ['media'] in SocketContext.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Filter, Image as ImageIcon, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, resolveMediaUrl } from '@firon/shared';
import { MEDIA_KINDS, MEDIA_STATUSES } from '../lib/constants.js';
import { fmtAgo, fmtBytes, fmtDuration } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import { useAuth } from '../context/AuthContext.jsx';
import useDebounced from '../hooks/useDebounced.js';
import {
  FP_Badge,
  FP_Button,
  FP_Card,
  FP_ConfirmDialog,
  FP_EmptyState,
  FP_ErrorState,
  FP_FileDrop,
  FP_KeyValueRow,
  FP_MediaThumb,
  FP_Modal,
  FP_Pagination,
  FP_Pressable,
  FP_ProgressBar,
  FP_Screen,
  FP_SearchInput,
  FP_Segmented,
  FP_Select,
  FP_SkeletonCards,
  FP_StatusBadge,
  FP_Textarea,
  useToast,
} from '../components/index.ts';

export default function Media() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const dSearch = useDebounced(search, 250);

  const [uploads, setUploads] = useState([]);   // { id, name, progress, error? }
  const [preview, setPreview] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(null);

  const params = {
    status: status || undefined,
    kind: kind || undefined,
    category: category || undefined,
    page,
    limit: 24,
  };

  const listQuery = useQuery({
    queryKey: isAdmin ? qk.mediaList(params) : qk.mediaMine(params),
    queryFn: () => (isAdmin ? api.media.list(params) : api.media.mine({ page, limit: 24 })),
  });

  const assets = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? null;

  const visible = useMemo(() => {
    const term = dSearch.trim().toLowerCase();
    if (!term) return assets;
    return assets.filter((a) => `${a.title ?? ''} ${a.originalName ?? ''} ${a.category ?? ''} ${(a.tags ?? []).join(' ')}`
      .toLowerCase().includes(term));
  }, [assets, dSearch]);

  const categories = useMemo(
    () => [...new Set(assets.map((a) => a.category).filter(Boolean))].sort(),
    [assets],
  );

  const pendingCount = assets.filter((a) => a.status === 'pending').length;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.media });

  /* ------------------------------- upload -------------------------------- */
  const uploadFiles = async (files) => {
    for (const file of files) {
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      const bump = (patch) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));

      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name.replace(/\.[^.]+$/, ''));
      form.append('kind', file.type.startsWith('video') ? 'video' : 'image');
      form.append('category', category || 'general');

      try {
        // eslint-disable-next-line no-await-in-loop
        const asset = await api.media.upload(form, (pct) => bump({ progress: pct }));
        bump({ progress: 100 });
        toast.success(`Uploaded ${asset.title}`, {
          sub: asset.status === 'approved' ? 'Approved' : 'Awaiting admin approval',
        });
        setTimeout(() => setUploads((u) => u.filter((x) => x.id !== id)), 1200);
        invalidate();
      } catch (err) {
        // The proxy already popped the alert; keep the row visible with why.
        bump({ error: err?.message ?? 'Upload failed' });
      }
    }
  };

  /* ------------------------------ moderation ----------------------------- */
  const approve = useMutation({
    mutationFn: (asset) => api.media.approve(asset.id),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ asset, rejectionReason }) => api.media.reject(asset.id, { reason: rejectionReason }),
    onSuccess: () => { setRejecting(null); setReason(''); invalidate(); },
  });

  const remove = useMutation({
    mutationFn: (asset) => api.media.remove(asset.id, { successMessage: 'Media deleted' }),
    onSuccess: () => { setDeleting(null); invalidate(); },
    onError: () => setDeleting(null),
  });

  return (
    <FP_Screen
      title={isAdmin ? 'Media library' : 'My uploads'}
      subtitle={isAdmin
        ? 'Exercise demos and app imagery · trainer uploads land here for approval'
        : 'Exercise demos · reviewed by admin before publishing'}
      actions={isAdmin && pendingCount > 0 ? (
        <FP_Button variant="secondary" icon={Filter} onPress={() => { setStatus('pending'); setPage(1); }}>
          {pendingCount} awaiting review
        </FP_Button>
      ) : null}
    >
      <FP_Card>
        <FP_FileDrop
          onFiles={uploadFiles}
          title="Upload demo video or image"
          sub={isAdmin ? 'Admin uploads are approved immediately' : 'MP4 or JPG · routed through admin approval'}
        />
        {uploads.length ? (
          <div className="col mt3">
            {uploads.map((u) => (
              <div key={u.id} className="col upload-row">
                <div className="row between small">
                  <span className="truncate">{u.name}</span>
                  <span className={u.error ? 'danger' : 'muted'}>{u.error ?? `${u.progress}%`}</span>
                </div>
                {u.error ? null : <FP_ProgressBar value={u.progress} />}
              </div>
            ))}
          </div>
        ) : null}
      </FP_Card>

      <div className="toolbar mt4">
        <div className="toolbar__grow">
          <FP_SearchInput value={search} onChange={setSearch} placeholder="Search title, filename, tag…" />
        </div>
        {isAdmin ? (
          <FP_Segmented
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[{ value: '', label: 'All' }, ...MEDIA_STATUSES.map((s) => ({ value: s, label: s }))]}
          />
        ) : null}
        <FP_Select
          value={kind}
          onChange={(e) => { setKind(e.target.value); setPage(1); }}
          options={MEDIA_KINDS}
          placeholder="All kinds"
          aria-label="Filter by kind"
        />
        <FP_Select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          options={categories}
          placeholder="All categories"
          aria-label="Filter by category"
        />
      </div>

      {listQuery.isError ? (
        <FP_ErrorState error={listQuery.error} onRetry={listQuery.refetch} title="Could not load media" />
      ) : null}
      {listQuery.isLoading ? <FP_SkeletonCards count={8} height={170} /> : null}

      {!listQuery.isLoading && !listQuery.isError ? (
        visible.length ? (
          <>
            <div className="media-grid">
              {visible.map((asset) => (
                <div key={asset.id} className={`media-card ${asset.status === 'pending' ? 'media-card--pending' : ''}`}>
                  <FP_Pressable className="media-card__btn" onPress={() => setPreview(asset)} label={`Preview ${asset.title}`}>
                    <FP_MediaThumb asset={asset} className="media-card__thumb" showVideo />
                    <span className="media-card__badges">
                      <FP_StatusBadge status={asset.status} />
                      <FP_Badge tone="muted">{asset.kind}</FP_Badge>
                    </span>
                    {asset.durationSec ? <span className="media-card__dur">{fmtDuration(asset.durationSec)}</span> : null}
                  </FP_Pressable>
                  <div className="media-card__body">
                    <div className="media-card__title truncate">{asset.title || asset.originalName}</div>
                    <div className="tiny muted">
                      {[asset.category, fmtBytes(asset.sizeBytes), fmtAgo(asset.createdAt)].filter(Boolean).join(' · ')}
                    </div>
                    <div className="tiny muted truncate">
                      by {typeof asset.uploadedBy === 'object' ? asset.uploadedBy?.name : '—'}
                    </div>
                    {asset.status === 'rejected' && asset.rejectionReason ? (
                      <div className="tiny danger">Rejected: {asset.rejectionReason}</div>
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <div className="media-card__foot">
                      {asset.status !== 'approved' ? (
                        <FP_Button size="sm" icon={Check} onPress={() => approve.mutate(asset)}>Approve</FP_Button>
                      ) : null}
                      {asset.status !== 'rejected' ? (
                        <FP_Button size="sm" variant="secondary" icon={X} onPress={() => { setRejecting(asset); setReason(''); }}>
                          Reject
                        </FP_Button>
                      ) : null}
                      <FP_Button size="sm" variant="danger" icon={Trash2} aria-label="Delete asset" onPress={() => setDeleting(asset)} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <FP_Pagination
              page={meta?.page ?? page}
              pages={meta?.pages ?? 1}
              total={meta?.total ?? visible.length}
              limit={meta?.limit}
              onChange={setPage}
            />
          </>
        ) : (
          <FP_EmptyState
            icon={ImageIcon}
            title="No media yet"
            message={search || status || kind
              ? 'No assets match these filters.'
              : 'Drop a file above to add the first asset.'}
          />
        )
      ) : null}

      {/* ------------------------------ preview ---------------------------- */}
      <FP_Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title ?? 'Preview'} size="md">
        {preview ? (
          <>
            <div className="media-preview__frame">
              {preview.kind === 'video' ? (
                <video
                  key={preview.id}
                  src={resolveMediaUrl(preview.url)}
                  className="media-preview"
                  controls
                  playsInline
                  preload="metadata"
                  poster={preview.thumbnailUrl ? resolveMediaUrl(preview.thumbnailUrl) : undefined}
                />
              ) : (
                <img
                  key={preview.id}
                  src={resolveMediaUrl(preview.url)}
                  alt={preview.title ?? ''}
                  className="media-preview"
                  loading="lazy"
                />
              )}
            </div>
            {preview.width && preview.height ? (
              <div className="media-preview__meta">
                {preview.width} × {preview.height} px
                {preview.durationSec ? ` · ${fmtDuration(preview.durationSec)}` : ''}
              </div>
            ) : null}
            <div className="mt3">
              <FP_KeyValueRow label="Status" value={<FP_StatusBadge status={preview.status} />} />
              <FP_KeyValueRow label="Kind" value={preview.kind} />
              <FP_KeyValueRow label="Category" value={preview.category ?? '—'} />
              <FP_KeyValueRow label="Size" value={fmtBytes(preview.sizeBytes)} />
              {preview.durationSec ? <FP_KeyValueRow label="Duration" value={fmtDuration(preview.durationSec)} /> : null}
              <FP_KeyValueRow
                label="Uploaded by"
                value={typeof preview.uploadedBy === 'object' ? preview.uploadedBy?.name : '—'}
              />
              <FP_KeyValueRow label="URL" value={<span className="mono truncate url-cell">{preview.url}</span>} />
            </div>
          </>
        ) : null}
      </FP_Modal>

      {/* ------------------------------- reject ---------------------------- */}
      <FP_Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.title ?? 'asset'}`}
        footer={(
          <>
            <FP_Button variant="secondary" onPress={() => setRejecting(null)}>Cancel</FP_Button>
            <FP_Button
              variant="danger"
              loading={reject.isPending}
              disabled={!reason.trim()}
              onPress={() => reject.mutate({ asset: rejecting, rejectionReason: reason })}
            >
              Reject with reason
            </FP_Button>
          </>
        )}
      >
        <FP_Textarea
          label="Reason (sent to the uploader)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Framing is too dark — please re-shoot from the side."
          maxLength={240}
          autoFocus
        />
      </FP_Modal>

      <FP_ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting)}
        title="Delete media asset"
        confirmLabel="Delete asset"
        message={`"${deleting?.title ?? deleting?.originalName ?? 'This asset'}" will be removed. Content keys or videos pointing at it will lose their media.`}
      />
    </FP_Screen>
  );
}
