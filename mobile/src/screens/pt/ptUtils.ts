/**
 * Small helpers shared by the four PT screens. UI-free on purpose — every visible
 * element still comes from an `FP_` component.
 */

/** `roster.map(r => r.n.split(' ')[0])` in the prototype. */
export function fpFirstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/** The prototype's `Number.toLocaleString()` grouping, without pulling in Intl polyfills. */
export function fpGroupNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** `parseInt` with the prototype's "keep the previous value unless the new one is > 0" rule. */
export function fpPositiveInt(raw: string, fallback: number): number {
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function fpIsEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** 'HH:mm' compare — the prototype's `d.from >= d.to` string comparison. */
export function fpTimeIsBefore(from: string, to: string): boolean {
  return from < to;
}

/** "3" -> "3", null -> "—" */
export function fpDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
}

/**
 * `Last active` value. The prototype hardcoded the word "Today"; CONTRACT §8 has no key for it,
 * so this renders a locale-free short date instead of smuggling in an untranslated literal.
 */
export function fpLastActive(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return '—';
  }
  return `${String(then.getDate()).padStart(2, '0')}/${String(then.getMonth() + 1).padStart(2, '0')}`;
}

/** `−3.2 kg` / `+1.4 kg` with the prototype's minus glyph. */
export function fpWeightDelta(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) {
    return '—';
  }
  const rounded = Math.round(kg * 10) / 10;
  if (rounded === 0) {
    return '0 kg';
  }
  return `${rounded < 0 ? '−' : '+'}${Math.abs(rounded).toFixed(1)} kg`;
}
