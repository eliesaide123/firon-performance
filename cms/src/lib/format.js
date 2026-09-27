import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

export function initialsOf(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';
}

const asDate = (v) => {
  if (!v) return null;
  const d = typeof v === 'string' ? parseISO(v) : new Date(v);
  return isValid(d) ? d : null;
};

export function fmtDate(v, pattern = 'd MMM yyyy') {
  const d = asDate(v);
  return d ? format(d, pattern) : '—';
}

export function fmtDateTime(v) {
  const d = asDate(v);
  return d ? format(d, 'd MMM yyyy, HH:mm') : '—';
}

export function fmtAgo(v) {
  const d = asDate(v);
  return d ? `${formatDistanceToNowStrict(d)} ago` : '—';
}

export function fmtBytes(n) {
  const b = Number(n);
  if (!b || Number.isNaN(b)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let v = b;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtNumber(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString() : '—';
}

export function fmtUptime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

/** Adherence colour thresholds (>=80 lime, >=70 amber, else red). */
export function adherenceTone(pct) {
  const v = Number(pct) || 0;
  if (v >= 80) return 'ok';
  if (v >= 70) return 'warn';
  return 'bad';
}

/** Short preview of any content value for a table cell. */
export function valuePreview(value, max = 80) {
  if (value == null || value === '') return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export const titleCase = (s = '') =>
  String(s).replace(/[-_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
