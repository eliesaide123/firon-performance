/**
 * The prototype's `editAvailability()` + `renderAvailabilityEditor()` + `readAvailability()` +
 * `applyToWeekdays()` + `closeWeekend()` + `saveAvailability()`.
 *
 * The whole point of this component is the draft: it seeds one working copy from the saved
 * availability on mount and mutates only that copy, so unmounting it (Cancel) discards every
 * edit — the prototype's `avDraft = null` semantics, expressed as component lifetime.
 * Because each `FP_TimePicker` is controlled by the draft, the prototype's DOM-reading
 * `readAvailability()` has no work left to do: the draft is always current.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { AvailabilityDay } from '@firon/shared';
import {
  FP_Button,
  FP_Card,
  FP_Chip,
  FP_ChipScroll,
  FP_CmsText,
  FP_Label,
  FP_Row,
  FP_TimePicker,
} from '../../../components';
import { useContent } from '../../../cms/ContentProvider';
import { FP_COLORS, FP_SPACING } from '../../../theme';
import { fpTimeIsBefore } from '../ptUtils';
import FP_PtSheetHead from './FP_PtSheetHead';

export interface FP_PtAvailabilityEditorProps {
  /** The saved week — copied once into the draft, never mutated. */
  availability: AvailabilityDay[];
  saving?: boolean;
  onSave: (draft: AvailabilityDay[]) => void;
  onCancel: () => void;
  /** The prototype toasts from `applyToWeekdays()` / `closeWeekend()`. */
  onToast: (key: string) => void;
  title: string;
  subtitle: string;
}

export const FP_PtAvailabilityEditor: React.FC<FP_PtAvailabilityEditorProps> = ({
  availability,
  saving = false,
  onSave,
  onCancel,
  onToast,
  title,
  subtitle,
}) => {
  const { t } = useContent();
  /* the working copy — `avDraft = coach.availability.map(d => ({ ...d }))` */
  const [draft, setDraft] = useState<AvailabilityDay[]>(() => availability.map(d => ({ ...d })));
  const [showError, setShowError] = useState(false);

  const invalid = useMemo(
    () => draft.map(d => !d.off && !fpTimeIsBefore(d.from, d.to)),
    [draft],
  );
  const hasError = invalid.some(Boolean);

  const patch = (index: number, next: Partial<AvailabilityDay>) => {
    setDraft(prev => prev.map((d, i) => (i === index ? { ...d, ...next } : d)));
    setShowError(false);
  };

  const applyToWeekdays = () => {
    setDraft(prev => {
      const monday = prev[0];
      if (!monday) {
        return prev;
      }
      return prev.map((d, i) =>
        i >= 1 && i <= 4 ? { ...d, from: monday.from, to: monday.to, off: monday.off } : d,
      );
    });
    setShowError(false);
    onToast('pt.profile.toast_copied');
  };

  const closeWeekend = () => {
    setDraft(prev => prev.map((d, i) => (i >= 5 ? { ...d, off: true } : d)));
    setShowError(false);
    onToast('pt.profile.toast_weekend_off');
  };

  const save = () => {
    if (hasError) {
      setShowError(true);
      return;
    }
    onSave(draft.map(d => ({ ...d })));
  };

  return (
    <>
      <FP_PtSheetHead title={title} subtitle={subtitle} />

      <FP_Card style={styles.card}>
        {draft.map((day, index) => (
          <FP_Row key={day.day} gap={FP_SPACING.sm} style={index ? styles.rowDivided : styles.row}>
            <FP_Label style={styles.day}>{day.day}</FP_Label>
            <FP_TimePicker
              value={day.from}
              disabled={day.off}
              invalid={invalid[index]}
              onChange={value => patch(index, { from: value })}
              accessibilityLabel={day.day}
            />
            <FP_Label style={styles.dash}>–</FP_Label>
            <FP_TimePicker
              value={day.to}
              disabled={day.off}
              invalid={invalid[index]}
              onChange={value => patch(index, { to: value })}
              accessibilityLabel={day.day}
            />
            <FP_Chip
              small
              active={!day.off}
              label={t(day.off ? 'pt.profile.off' : 'pt.profile.on')}
              onPress={() => patch(index, { off: !day.off })}
            />
          </FP_Row>
        ))}
      </FP_Card>

      {showError ? (
        <FP_CmsText k="pt.profile.availability_err" variant="sub" style={styles.error} />
      ) : null}

      <FP_ChipScroll style={styles.actions}>
        <FP_Chip label={t('pt.profile.cta_copy_weekdays')} onPress={applyToWeekdays} />
        <FP_Chip label={t('pt.profile.cta_weekend_off')} onPress={closeWeekend} />
      </FP_ChipScroll>

      <FP_Button style={styles.save} loading={saving} title={t('pt.profile.cta_save_availability')} onPress={save} />
      <FP_Button style={styles.cancel} variant="ghost" title={t('common.cta_cancel')} onPress={onCancel} />
    </>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: FP_SPACING.lg },
  row: { paddingVertical: 9 },
  rowDivided: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: FP_COLORS.line },
  day: { width: 34, flexGrow: 0, flexShrink: 0, fontWeight: '700', fontSize: 13, color: FP_COLORS.text },
  dash: { flexGrow: 0, flexShrink: 0 },
  error: { color: FP_COLORS.danger, marginTop: FP_SPACING.sm },
  actions: { marginTop: FP_SPACING.md },
  save: { marginTop: FP_SPACING.xl },
  cancel: { marginTop: FP_SPACING.md },
});

export default FP_PtAvailabilityEditor;
