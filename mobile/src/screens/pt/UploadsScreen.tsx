/**
 * PT tab 3 — the prototype's `pt-uploads` screen and its `uploadSheet()`.
 *
 * Dashed dropzone -> `react-native-image-picker` -> title/category sheet ->
 * `POST /media/upload` (multipart field `file`) with a live progress bar. The list below is
 * `GET /media/mine`; `media:status` flips a badge the moment an admin approves, because the
 * SocketProvider invalidates `QK.myUploads` and this screen's resource re-fetches on that.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { api, type FormDataLike, type MediaAsset } from '@firon/shared';
import {
  FP_AppHeader,
  FP_Badge,
  FP_BottomSheet,
  FP_Button,
  FP_Card,
  FP_Chip,
  FP_ChipScroll,
  FP_CmsText,
  FP_EmptyState,
  FP_ErrorState,
  FP_Icon,
  FP_ListItem,
  FP_ProgressBar,
  FP_Screen,
  FP_Skeleton,
  FP_Textbox,
  FP_Thumb,
} from '../../components';
import { useContent } from '../../cms/ContentProvider';
import { useToast } from '../../components/FP_ToastProvider';
import { useSocketEvent } from '../../realtime/SocketProvider';
import useResource from '../../store/useResource';
import { QK } from '../../store/queryCache';
import { FP_COLORS, FP_SPACING } from '../../theme';
import FP_PtSectionHead from './components/FP_PtSectionHead';
import FP_PtSheetHead from './components/FP_PtSheetHead';

/** `GET /media/mine` adds a formatted duration the shared DTO does not spell out. */
type MineAsset = MediaAsset & { durationLabel?: string | null; absoluteUrl?: string };

interface Picked {
  uri: string;
  name: string;
  type: string;
  kind: 'image' | 'video';
  durationSec?: number;
}

function fpToPicked(asset: Asset, kind: 'image' | 'video'): Picked | null {
  if (!asset.uri) {
    return null;
  }
  return {
    uri: asset.uri,
    name: asset.fileName ?? (kind === 'video' ? 'upload.mp4' : 'upload.jpg'),
    type: asset.type ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
    kind,
    durationSec: asset.duration,
  };
}

const UploadsScreen: React.FC = () => {
  const { t } = useContent();
  const { toast } = useToast();

  const mine = useResource<MediaAsset[]>(
    QK.myUploads,
    async () => (await api.media.mine()).data,
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [errors, setErrors] = useState<{ title: boolean; file: boolean }>({
    title: false,
    file: false,
  });
  const [progress, setProgress] = useState<number | null>(null);

  /**
   * The SocketProvider already invalidates `QK.myUploads` on `media:status`, which makes
   * `useResource` re-fetch. This subscription is the belt-and-braces refresh so the badge
   * flips even if the cache entry was re-seeded in between.
   */
  useSocketEvent('media:status', () => {
    void mine.refresh();
  });

  // useMemo so the `?? []` fallback is referentially stable.
  const assets = useMemo(() => (mine.data ?? []) as MineAsset[], [mine.data]);
  const uploading = progress !== null;

  const closeSheet = useCallback(() => {
    if (uploading) {
      return;
    }
    setSheetOpen(false);
  }, [uploading]);

  const openSheet = useCallback(() => {
    setTitle('');
    setCategory('');
    setPicked(null);
    setErrors({ title: false, file: false });
    setProgress(null);
    setSheetOpen(true);
  }, []);

  const pick = useCallback(async (kind: 'image' | 'video') => {
    const response = await launchImageLibrary({
      mediaType: kind === 'video' ? 'video' : 'photo',
      selectionLimit: 1,
      includeExtra: true,
    });
    if (response.didCancel || !response.assets?.length) {
      return;
    }
    const next = fpToPicked(response.assets[0], kind);
    if (next) {
      setPicked(next);
      setErrors(prev => ({ ...prev, file: false }));
    }
  }, []);

  const submit = useCallback(async () => {
    const trimmed = title.trim();
    const next = { title: !trimmed, file: !picked };
    setErrors(next);
    if (next.title || next.file || !picked) {
      return;
    }

    const form = new FormData();
    /* React Native needs the `{ uri, type, name }` shape, under the field name `file`. */
    form.append('file', { uri: picked.uri, type: picked.type, name: picked.name } as unknown as Blob);
    form.append('title', trimmed);
    if (category.trim()) {
      form.append('category', category.trim());
    }
    form.append('kind', picked.kind);
    if (picked.durationSec) {
      form.append('durationSec', String(Math.round(picked.durationSec)));
    }

    setProgress(0);
    try {
      await api.media.upload(form as unknown as FormDataLike, pct => setProgress(pct));
      setSheetOpen(false);
      toast(t('pt.uploads.toast_submitted'));
      await mine.refresh();
    } finally {
      setProgress(null);
    }
  }, [category, mine, picked, t, title, toast]);

  const header = <FP_AppHeader large title={t('pt.uploads.title')} />;

  const rows = useMemo(
    () =>
      assets.map((asset, index) => {
        const approved = asset.status === 'approved';
        const rejected = asset.status === 'rejected';
        /**
         * The prototype's "Video · 0:45" sub-line. CONTRACT §8 has no key for the words
         * "Video"/"Image", so this uses only server-supplied data: the category the trainer
         * picked and the formatted duration.
         */
        const meta = [asset.category, asset.durationLabel].filter(Boolean).join(' · ');
        return (
          <FP_ListItem
            key={asset.id}
            last={index === assets.length - 1}
            left={
              <FP_Thumb
                width={64}
                height={48}
                showPlay={false}
                gradientIndex={index + 2}
                thumbnailUrl={asset.kind === 'image' ? asset.absoluteUrl ?? asset.url : null}
              />
            }
            title={asset.title}
            subtitle={meta || undefined}
            right={
              <FP_Badge
                tone={approved ? 'ok' : rejected ? 'danger' : 'warn'}
                label={t(
                  approved
                    ? 'pt.uploads.badge_approved'
                    : rejected
                    ? 'pt.uploads.badge_rejected'
                    : 'pt.uploads.badge_pending',
                )}
              />
            }
          />
        );
      }),
    [assets, t],
  );

  return (
    <FP_Screen onRefresh={mine.refresh} refreshing={mine.loading && !mine.initialLoading}>
      {header}
      <FP_CmsText k="pt.uploads.subtitle" variant="sub" />

      <FP_Card dashed style={styles.dropzone} onPress={openSheet}>
        <View style={styles.dropzoneInner}>
          <FP_Icon name="upload" size={30} color={FP_COLORS.accent} />
          <FP_CmsText k="pt.uploads.dropzone_title" style={styles.dropzoneTitle} />
          <FP_CmsText k="pt.uploads.dropzone_sub" variant="sub" style={styles.center} />
        </View>
      </FP_Card>

      <FP_PtSectionHead k="pt.uploads.mine_title" />

      {mine.error ? (
        <FP_ErrorState
          title={t('common.error_generic')}
          message={mine.error.message}
          retryLabel={t('common.retry')}
          onRetry={mine.refresh}
        />
      ) : mine.initialLoading ? (
        <View style={styles.block}>
          <FP_Skeleton height={62} style={styles.rowSkeleton} />
          <FP_Skeleton height={62} style={styles.rowSkeleton} />
          <FP_Skeleton height={62} style={styles.rowSkeleton} />
        </View>
      ) : assets.length === 0 ? (
        <FP_EmptyState
          title={t('pt.uploads.empty')}
          icon={<FP_Icon name="upload" size={26} color={FP_COLORS.muted} />}
        />
      ) : (
        <View style={styles.block}>{rows}</View>
      )}

      <FP_BottomSheet visible={sheetOpen} onClose={closeSheet}>
        <FP_PtSheetHead title={t('pt.uploads.sheet_title')} subtitle={t('pt.uploads.sheet_sub')} />

        <FP_Textbox
          label={t('pt.uploads.title_label')}
          placeholder={t('pt.uploads.title_ph')}
          value={title}
          onChangeText={setTitle}
          error={errors.title ? t('pt.uploads.err_title') : null}
          containerStyle={styles.sheetField}
        />
        <FP_Textbox
          label={t('pt.uploads.category_label')}
          placeholder={t('pt.uploads.category_ph')}
          value={category}
          onChangeText={setCategory}
        />

        <FP_Card dashed style={styles.pickCard}>
          <View style={styles.dropzoneInner}>
            <FP_Icon name={picked?.kind === 'image' ? 'camera' : 'video'} size={26} color={FP_COLORS.accent} />
            {picked ? (
              <FP_Textbox value={picked.name} editable={false} dense containerStyle={styles.pickedName} />
            ) : (
              <FP_CmsText k="pt.uploads.pick_file" variant="sub" style={styles.center} />
            )}
            <FP_ChipScroll style={styles.pickChips}>
              <FP_Chip label={t('pt.uploads.pick_video')} onPress={() => void pick('video')} />
              <FP_Chip label={t('pt.uploads.pick_image')} onPress={() => void pick('image')} />
            </FP_ChipScroll>
          </View>
        </FP_Card>

        {errors.file ? (
          <FP_CmsText k="pt.uploads.err_file" variant="sub" style={styles.error} />
        ) : null}

        {uploading ? (
          <View style={styles.progressWrap}>
            <FP_CmsText
              k="pt.uploads.uploading"
              vars={{ pct: Math.round(progress ?? 0) }}
              variant="sub"
            />
            <FP_ProgressBar progress={(progress ?? 0) / 100} style={styles.progressBar} />
          </View>
        ) : null}

        <FP_Button
          style={styles.cta}
          loading={uploading}
          title={t('pt.uploads.cta_submit')}
          onPress={submit}
        />
      </FP_BottomSheet>
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  dropzone: { marginTop: FP_SPACING.lg },
  dropzoneInner: { alignItems: 'center', gap: FP_SPACING.sm },
  dropzoneTitle: { fontWeight: '700', textAlign: 'center' },
  center: { textAlign: 'center' },
  block: { marginTop: FP_SPACING.sm },
  rowSkeleton: { marginTop: FP_SPACING.sm },
  sheetField: { marginTop: FP_SPACING.lg },
  pickCard: { marginTop: FP_SPACING.lg },
  pickedName: { alignSelf: 'stretch' },
  pickChips: { marginTop: FP_SPACING.xs },
  error: { color: FP_COLORS.danger, marginTop: FP_SPACING.sm },
  progressWrap: { marginTop: FP_SPACING.lg, gap: FP_SPACING.sm },
  progressBar: { marginTop: FP_SPACING.xs },
  cta: { marginTop: FP_SPACING.xl },
});

export default UploadsScreen;
