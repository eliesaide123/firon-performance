'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { todayKey } = require('../utils/text');
const planService = require('../services/planService');
const { emitToCoach } = require('../realtime/emit');

/**
 * GET /api/nutrition/today
 * The Nutrition screen: the active diet plan's meals merged with today's
 * MealLog rows (so the checkboxes and the kcal ring are in sync), plus every
 * manually-logged meal.
 */
exports.today = asyncHandler(async (req, res) => {
  const { DietPlan, MealLog } = require('../models');
  const date = req.query.date || todayKey();

  const plan = await DietPlan.findOne({ clientId: req.user._id, status: 'active' })
    .populate('trainerId', 'name')
    .lean();

  const logs = await MealLog.find({ userId: req.user._id, date }).lean();
  const planLogBySlot = {};
  logs.filter((l) => l.source === 'plan').forEach((l) => { planLogBySlot[l.slot] = l; });

  const planMeals = ((plan && plan.meals) || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((m, index) => {
      const log = planLogBySlot[m.slot];
      return {
        index,
        slot: m.slot,
        food: m.food,
        kcal: m.kcal || 0,
        protein: m.protein || 0,
        carbs: m.carbs || 0,
        fat: m.fat || 0,
        source: 'plan',
        consumed: !!(log && log.consumed),
        logId: log ? String(log._id) : null,
      };
    });

  const manualMeals = logs
    .filter((l) => l.source === 'manual')
    .map((l) => ({
      index: null,
      id: String(l._id),
      logId: String(l._id),
      slot: l.slot,
      food: l.food,
      kcal: l.kcal || 0,
      protein: l.protein || 0,
      carbs: l.carbs || 0,
      fat: l.fat || 0,
      source: 'manual',
      consumed: !!l.consumed,
    }));

  const all = [...planMeals, ...manualMeals];
  const consumed = all.filter((m) => m.consumed);
  const sum = (key) => consumed.reduce((a, m) => a + (m[key] || 0), 0);

  const targets = plan
    ? {
      kcal: plan.kcal || planService.dietTotals(plan).kcal,
      protein: plan.protein || 0,
      carbs: plan.carbs || 0,
      fat: plan.fat || 0,
    }
    : { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  const consumedKcal = sum('kcal');

  return ok(res, {
    date,
    plan: plan
      ? {
        id: String(plan._id),
        name: plan.name,
        coachName: plan.trainerId ? plan.trainerId.name : null,
        coachFirstName: plan.trainerId ? String(plan.trainerId.name || '').split(' ')[0] : null,
      }
      : null,
    targets,
    consumed: {
      kcal: consumedKcal,
      protein: sum('protein'),
      carbs: sum('carbs'),
      fat: sum('fat'),
    },
    remainingKcal: Math.max(0, targets.kcal - consumedKcal),
    progressPct: targets.kcal ? Math.round((consumedKcal / targets.kcal) * 100) : 0,
    meals: all,
  });
});

/* POST /api/nutrition/log */
exports.log = asyncHandler(async (req, res) => {
  const { MealLog, DietPlan } = require('../models');
  const date = req.body.date || todayKey();

  let dietPlanId = req.body.dietPlanId || undefined;
  if (!dietPlanId) {
    const active = await DietPlan.findOne({ clientId: req.user._id, status: 'active' }).select('_id').lean();
    if (active) dietPlanId = active._id;
  }

  const log = await MealLog.create({
    userId: req.user._id,
    dietPlanId,
    date,
    slot: req.body.slot,
    food: req.body.food,
    kcal: req.body.kcal || 0,
    protein: req.body.protein || 0,
    carbs: req.body.carbs || 0,
    fat: req.body.fat || 0,
    consumed: req.body.consumed !== undefined ? req.body.consumed : true,
    source: 'manual',
  });

  const trainerId = req.user.clientProfile && req.user.clientProfile.trainerId;
  emitToCoach(trainerId, 'client:log', {
    clientId: String(req.user._id),
    kind: 'meal',
    payload: { slot: log.slot, food: log.food, kcal: log.kcal, consumed: log.consumed, date },
  });

  const dayLogs = await MealLog.find({ userId: req.user._id, date, consumed: true }).lean();
  return created(res, {
    log: { ...(log.toJSON ? log.toJSON() : log), id: String(log._id) },
    kcalToday: dayLogs.reduce((a, m) => a + (m.kcal || 0), 0),
  });
});

/* PATCH /api/nutrition/log/:id/toggle */
exports.toggleLog = asyncHandler(async (req, res) => {
  const { MealLog } = require('../models');
  const log = await MealLog.findById(req.params.id);
  if (!log) throw new ApiError(404, 'LOG_NOT_FOUND', 'That meal log does not exist');
  if (String(log.userId) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'That meal log is not yours');
  }

  log.consumed = req.body && typeof req.body.done === 'boolean' ? req.body.done : !log.consumed;
  await log.save();

  const dayLogs = await MealLog.find({ userId: log.userId, date: log.date, consumed: true }).lean();
  const trainerId = req.user.clientProfile && req.user.clientProfile.trainerId;
  emitToCoach(trainerId, 'client:log', {
    clientId: String(log.userId),
    kind: 'meal',
    payload: { slot: log.slot, food: log.food, kcal: log.kcal, consumed: log.consumed, date: log.date },
  });

  return ok(res, {
    id: String(log._id),
    consumed: log.consumed,
    kcalToday: dayLogs.reduce((a, m) => a + (m.kcal || 0), 0),
  });
});

/* GET /api/nutrition/history?from=&to= */
exports.history = asyncHandler(async (req, res) => {
  const { MealLog } = require('../models');

  const to = req.query.to || todayKey();
  let { from } = req.query;
  if (!from) {
    const d = new Date(to);
    d.setDate(d.getDate() - 13);
    from = todayKey(d);
  }

  const rows = await MealLog.find({
    userId: req.user._id,
    date: { $gte: from, $lte: to },
  }).sort({ date: 1 }).lean();

  const byDate = {};
  rows.forEach((r) => {
    if (!byDate[r.date]) {
      byDate[r.date] = { date: r.date, kcal: 0, protein: 0, carbs: 0, fat: 0, meals: 0, consumedMeals: 0 };
    }
    const d = byDate[r.date];
    d.meals += 1;
    if (r.consumed) {
      d.consumedMeals += 1;
      d.kcal += r.kcal || 0;
      d.protein += r.protein || 0;
      d.carbs += r.carbs || 0;
      d.fat += r.fat || 0;
    }
  });

  const days = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  const avgKcal = days.length ? Math.round(days.reduce((a, d) => a + d.kcal, 0) / days.length) : 0;

  return ok(res, { from, to, days, avgKcal }, { count: days.length });
});
