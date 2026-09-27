import clsx from 'clsx';
import type { ReactNode } from 'react';

export type FP_BadgeTone = 'ok' | 'warn' | 'pt' | 'danger' | 'muted';

export interface FP_BadgeProps {
  tone?: FP_BadgeTone;
  children?: ReactNode;
  className?: string;
  title?: string;
}

/** Pill label. */
export default function FP_Badge({ tone, children, className, title }: FP_BadgeProps) {
  return <span className={clsx('badge', tone && `badge--${tone}`, className)} title={title}>{children}</span>;
}

const STATUS_TONE: Record<string, FP_BadgeTone> = {
  approved: 'ok', pending: 'warn', rejected: 'danger',
  active: 'ok', draft: 'warn', archived: 'muted',
  ok: 'ok', warn: 'warn', new: 'pt',
  admin: 'pt', trainer: 'ok', client: 'muted',
  published: 'ok', unpublished: 'muted',
};

export interface FP_StatusBadgeProps { status?: string | null; children?: ReactNode }

/** Badge whose tone is derived from a known status string. */
export function FP_StatusBadge({ status, children }: FP_StatusBadgeProps) {
  if (!status) return null;
  return <FP_Badge tone={STATUS_TONE[String(status).toLowerCase()] || 'muted'}>{children ?? status}</FP_Badge>;
}
