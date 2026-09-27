import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FPAlertPayload, FPAlertVariant } from '@firon/shared';
import { FP_COLORS, FP_SPACING, FP_TYPE } from '../theme';
import FP_Button from './FP_Button';
import FP_Icon, { FP_IconName } from './FP_Icon';
import FP_Modal from './FP_Modal';

export interface FP_AlertProps {
  alert: FPAlertPayload | null;
  onDismiss: (id: string) => void;
}

const ACCENTS: Record<FPAlertVariant, string> = {
  error: FP_COLORS.danger,
  success: FP_COLORS.accent,
  warning: FP_COLORS.warn,
  info: FP_COLORS.accent2,
  confirm: FP_COLORS.accent,
};

const ICONS: Record<FPAlertVariant, FP_IconName> = {
  error: 'warning',
  success: 'check',
  warning: 'warning',
  info: 'bell',
  confirm: 'warning',
};

/**
 * The popup `clientProxy` raises for a failed call, and that `fpAlert.*` raises directly.
 * A pure presenter — it holds no business logic (CONTRACT §11.4).
 *
 * Never React Native's built-in `Alert.alert`.
 */
export const FP_Alert: React.FC<FP_AlertProps> = ({ alert, onDismiss }) => {
  if (!alert) {
    return null;
  }
  const accent = ACCENTS[alert.variant];
  const dismissable = alert.variant !== 'confirm';

  const runAction = async (index: number): Promise<void> => {
    const action = alert.actions?.[index];
    if (!action) {
      return;
    }
    try {
      await action.onPress?.();
    } finally {
      if (action.dismiss !== false) {
        onDismiss(alert.id);
      }
    }
  };

  return (
    <FP_Modal
      visible
      onClose={() => dismissable && onDismiss(alert.id)}
      dismissOnBackdrop={dismissable}
      style={{ borderColor: accent }}
      testID="fp-alert"
    >
      <View style={styles.headRow}>
        <View style={[styles.iconPill, { borderColor: accent }]}>
          <FP_Icon name={ICONS[alert.variant]} size={18} color={accent} />
        </View>
        <Text style={[FP_TYPE.sheetTitle, styles.title]} numberOfLines={3}>
          {alert.title}
        </Text>
      </View>

      {alert.message ? <Text style={styles.message}>{alert.message}</Text> : null}

      {alert.technical ? (
        <Text style={[FP_TYPE.mono, styles.technical]} numberOfLines={3}>
          {alert.technical}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {alert.actions && alert.actions.length > 0 ? (
          alert.actions.map((action, index) => (
            <FP_Button
              key={`${action.label}-${index}`}
              title={action.label}
              variant={
                action.kind === 'ghost' ? 'ghost' : action.kind === 'danger' ? 'danger' : 'primary'
              }
              onPress={() => void runAction(index)}
            />
          ))
        ) : (
          <FP_Button title="OK" onPress={() => onDismiss(alert.id)} />
        )}
      </View>
    </FP_Modal>
  );
};

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: FP_SPACING.md },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1 },
  message: { ...FP_TYPE.sub, marginTop: FP_SPACING.md, lineHeight: 19 },
  technical: { marginTop: FP_SPACING.md, opacity: 0.8 },
  actions: { marginTop: FP_SPACING.xl, gap: FP_SPACING.md },
});

export default FP_Alert;
