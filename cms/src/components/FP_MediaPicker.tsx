/*
 * Browse the approved MediaAsset library or upload a new file, then hand the
 * chosen asset back. Used by every image/video content row, the video form and
 * the exercise demo field.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, type MediaAsset, type MediaKind } from '@firon/shared';
import { fmtBytes, fmtDuration } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import useDebounced from '../hooks/useDebounced.js';
import FP_Button from './FP_Button';
import FP_EmptyState from './FP_EmptyState';
import FP_ErrorState from './FP_ErrorState';
import FP_FileDrop from './FP_FileDrop';
import FP_MediaThumb from './FP_MediaThumb';
import FP_Modal from './FP_Modal';
import FP_ProgressBar from './FP_ProgressBar';
import FP_SearchInput from './FP_SearchInput';
import FP_SkeletonRows from './FP_SkeletonRows';
import FP_Tabs from './FP_Tabs';
import FP_Textbox from './FP_Textbox';
import { useToast } from './FP_ToastProvider';

export interface FP_MediaPickerProps {
  open: boolean;
  onClose: () => void;
  /** Called with the picked asset, or null when the value is cleared. */
  onSelect: (asset: MediaAsset | null) => void;
  kind?: MediaKind;
  selectedId?: string | null;
  title?: string;
  allowClear?: boolean;
}

export default function FP_MediaPicker({
  open, onClose, onSelect, kind, selectedId, title = 'Choose media', allowClear = true,
}: FP_MediaPickerProps) {
  const [tab, setTab] = useState('library');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [uploadTitle, setUploadTitle] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const filters = { status: 'approved' as const, kind, limit: 60 };
  const listQuery = useQuery({
    queryKey: qk.mediaList({ picker: true, ...filters }),
    queryFn: () => api.media.list(filters),
    enabled: open,
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('title', uploadTitle || file.name.replace(/\.[^.]+$/, ''));
      form.append('kind', file.type.startsWith('video') ? 'video' : 'image');
      form.append('category', 'cms');
      setProgress(0);
      return api.media.upload(form, setProgress);
    },
    onSuccess: (asset) => {
      setProgress(null);
      setUploadTitle('');
      queryClient.invalidateQueries({ queryKey: qk.media });
      toast.success(`Uploaded ${asset.title}`, {
        sub: asset.status === 'approved' ? 'Approved' : 'Pending admin approval',
      });
      if (asset.status === 'approved') { onSelect(asset); onClose(); }
      else setTab('library');
    },
    // The proxy already showed the failure popup; just clear the progress bar.
    onSettled: () => setProgress(null),
  });

  const all = listQuery.data?.data ?? [];
  const items = dq
    ? all.filter((a) => `${a.title} ${a.originalName ?? ''} ${a.category ?? ''}`.toLowerCase().includes(dq.toLowerCase()))
    : all;

  return (
    <FP_Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={(
        <>
          {allowClear ? (
            <FP_Button variant="danger" icon={Trash2} onPress={() => { onSelect(null); onClose(); }}>
              Clear value
            </FP_Button>
          ) : null}
          <FP_Button variant="secondary" onPress={onClose}>Cancel</FP_Button>
        </>
      )}
    >
      <FP_Tabs
        value={tab}
        onChange={setTab}
        tabs={[{ value: 'library', label: 'Approved library' }, { value: 'upload', label: 'Upload new' }]}
      />

      {tab === 'library' ? (
        <div className="mt3">
          <FP_SearchInput value={q} onChange={setQ} placeholder="Search media by title or category…" />
          <div className="mt3">
            {listQuery.isLoading ? <FP_SkeletonRows rows={4} height={40} /> : null}
            {listQuery.isError ? <FP_ErrorState error={listQuery.error} onRetry={listQuery.refetch} /> : null}
            {!listQuery.isLoading && !listQuery.isError && !items.length ? (
              <FP_EmptyState
                title="No approved media yet"
                message={`Upload a ${kind ?? 'file'} here, or approve a pending asset in the media library.`}
                action={<FP_Button variant="secondary" onPress={() => setTab('upload')}>Upload one</FP_Button>}
              />
            ) : null}
            {items.length ? (
              <div className="media-picker-grid">
                {items.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className={`media-pick ${asset.id === selectedId ? 'is-selected' : ''}`}
                    onClick={() => { onSelect(asset); onClose(); }}
                  >
                    <FP_MediaThumb asset={asset} showVideo />
                    <span className="media-pick__label">
                      <span className="truncate">{asset.title || asset.originalName}</span>
                      <span className="tiny muted row" style={{ gap: 5 }}>
                        <span>{asset.kind}</span>
                        {asset.durationSec ? <span>· {fmtDuration(asset.durationSec)}</span> : null}
                        {asset.sizeBytes ? <span>· {fmtBytes(asset.sizeBytes)}</span> : null}
                        {asset.id === selectedId ? <Check size={11} /> : null}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'upload' ? (
        <div className="mt3 col">
          <FP_Textbox
            label="Title"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder="Deadlift form cue"
          />
          <FP_FileDrop
            multiple={false}
            accept={kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : 'image/*,video/*'}
            title={`Upload ${kind ?? 'image or video'}`}
            sub="Admin uploads publish instantly · trainer uploads wait for approval"
            disabled={upload.isPending}
            onFiles={(files) => upload.mutate(files[0]!)}
          />
          {progress != null ? (
            <div className="col" style={{ gap: 6 }}>
              <FP_ProgressBar value={progress} />
              <span className="tiny muted">Uploading… {progress}%</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </FP_Modal>
  );
}
