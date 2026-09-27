'use strict';

/** 'Full Body HIIT!' -> 'full-body-hiit' */
function slugify(input, { max = 60 } = {}) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'file';
}

/** 1450 -> '24:10' */
function durationLabel(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** '24:10' -> 1450 */
function labelToSeconds(label) {
  if (!label || typeof label !== 'string') return 0;
  const parts = label.split(':').map((p) => parseInt(p, 10) || 0);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** 'Elie Saide' -> 'ES' (mirrors the prototype's initials()) */
function initials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => (x[0] || '').toUpperCase())
    .join('');
}

/** Escapes a user string so it is safe inside a RegExp. */
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Today (server local time) as YYYY-MM-DD, matching the log models' `date` field. */
function todayKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

module.exports = { slugify, durationLabel, labelToSeconds, initials, escapeRegex, todayKey };
