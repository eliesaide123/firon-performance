'use strict';

const { todayKey } = require('../utils/text');

/** done days / total days * 100, rounded — mirrors the TrainingPlan virtual. */
function adherencePct(plan) {
  if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) return 0;
  if (typeof plan.adherencePct === 'number') return plan.adherencePct;
  const done = plan.days.filter((d) => d.status === 'done').length;
  return Math.round((done / plan.days.length) * 100);
}

/**
 * The prototype's roster colour thresholds:
 *   no active plan -> 'new'
 *   adherence < 70 -> 'warn'   (danger red)
 *   otherwise      -> 'ok'     (>=80 lime, 70-79 amber)
 */
function rosterStatus({ hasActivePlan, adherence }) {
  if (!hasActivePlan) return 'new';
  if ((adherence || 0) < 70) return 'warn';
  return 'ok';
}

/** 'Fat Loss · Wk 4' from the plan name + weekNumber. */
function planLabel(plan) {
  if (!plan) return 'Onboarding';
  if (plan.weekNumber) {
    const base = String(plan.name || 'Plan').replace(/\s*[·-]\s*(week|wk)\s*\d+\s*$/i, '');
    return `${base} · Wk ${plan.weekNumber}`;
  }
  return plan.name || 'Plan';
}

function dayCounts(day) {
  const list = (day && day.exercises) || [];
  return { doneCount: list.filter((e) => e.done).length, total: list.length };
}

/** After a day is completed: the next `todo` day becomes `now`. */
function advanceNextDay(plan, completedIndex) {
  const ordered = [...plan.days].sort((a, b) => a.dayIndex - b.dayIndex);
  const pos = ordered.findIndex((d) => d.dayIndex === completedIndex);
  for (let i = pos + 1; i < ordered.length; i += 1) {
    if (ordered[i].status === 'todo') {
      ordered[i].status = 'now';
      ordered[i].locked = false;
      return ordered[i];
    }
    if (ordered[i].status === 'now') return ordered[i];
  }
  return null;
}

/** Sum of a diet plan's meals. */
function dietTotals(plan) {
  const meals = (plan && plan.meals) || [];
  return meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal || 0),
      protein: acc.protein + (m.protein || 0),
      carbs: acc.carbs + (m.carbs || 0),
      fat: acc.fat + (m.fat || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** The day the client is on right now: the `now` day, else the first not-done. */
function currentDay(plan) {
  if (!plan || !Array.isArray(plan.days)) return null;
  return plan.days.find((d) => d.status === 'now')
    || plan.days.find((d) => d.status !== 'done')
    || null;
}

/** '4 × 12 · 20kg' from structured fields (prototype's exercise subtitle). */
function prescriptionOf(ex) {
  if (ex.prescription) return ex.prescription;
  const parts = [];
  if (ex.sets && ex.reps) parts.push(`${ex.sets} × ${ex.reps}`);
  else if (ex.sets) parts.push(`${ex.sets} sets`);
  else if (ex.reps) parts.push(`${ex.reps} reps`);
  if (ex.weightKg) parts.push(`${ex.weightKg}kg`);
  return parts.join(' · ');
}

module.exports = {
  adherencePct,
  rosterStatus,
  planLabel,
  dayCounts,
  advanceNextDay,
  dietTotals,
  currentDay,
  prescriptionOf,
  todayKey,
};
