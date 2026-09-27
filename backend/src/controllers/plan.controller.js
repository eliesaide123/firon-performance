'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { todayKey } = require('../utils/text');
const planService = require('../services/planService');
const accessService = require('../services/accessService');
const notificationService = require('../services/notificationService');
const { emitToUser, emitToCoach } = require('../realtime/emit');
const logger = require('../utils/logger');

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function serialiseTraining(plan) {
  const o = typeof plan.toJSON === 'function' ? plan.toJSON() : { ...plan };
  if (o._id && !o.id) { o.id = String(o._id); delete o._id; }
  delete o.__v;
  o.days = (o.days || [])
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((d) => ({
      ...d,
      exercises: (d.exercises || []).map((e) => ({ ...e, prescription: planService.prescriptionOf(e) })),
      doneCount: (d.exercises || []).filter((e) => e.done).length,
      total: (d.exercises || []).length,
    }));
  o.adherencePct = planService.adherencePct(o);
  o.doneDays = o.days.filter((d) => d.status === 'done').length;
  o.totalDays = o.days.length;
  o.planLabel = planService.planLabel(o);
  const cur = planService.currentDay(o);
  o.currentDayIndex = cur ? cur.dayIndex : null;
  if (o.clientId && typeof o.clientId === 'object') {
    o.client = { id: String(o.clientId._id || o.clientId.id), name: o.clientId.name };
    o.clientId = o.client.id;
  }
  if (o.trainerId && typeof o.trainerId === 'object') {
    o.trainer = {
      id: String(o.trainerId._id || o.trainerId.id),
      name: o.trainerId.name,
      firstName: String(o.trainerId.name || '').split(' ')[0],
    };
    o.trainerId = o.trainer.id;
  }
  return o;
}

function serialiseDiet(plan) {
  const o = typeof plan.toJSON === 'function' ? plan.toJSON() : { ...plan };
  if (o._id && !o.id) { o.id = String(o._id); delete o._id; }
  delete o.__v;
  o.meals = (o.meals || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  o.totals = planService.dietTotals(o);
  o.totalKcal = o.totals.kcal;
  if (o.clientId && typeof o.clientId === 'object') {
    o.client = { id: String(o.clientId._id || o.clientId.id), name: o.clientId.name };
    o.clientId = o.client.id;
  }
  if (o.trainerId && typeof o.trainerId === 'object') {
    o.trainer = {
      id: String(o.trainerId._id || o.trainerId.id),
      name: o.trainerId.name,
      firstName: String(o.trainerId.name || '').split(' ')[0],
    };
    o.trainerId = o.trainer.id;
  }
  return o;
}

const POP = [
  { path: 'clientId', select: 'name email avatarUrl' },
  { path: 'trainerId', select: 'name email avatarUrl' },
];

/** Normalises the incoming `days` array (fills dayLabel, orders exercises). */
function normaliseDays(days = []) {
  return days.map((d) => ({
    ...d,
    dayLabel: d.dayLabel || DAY_LABELS[d.dayIndex] || DAY_LABELS[0],
    status: d.status || 'todo',
    exercises: (d.exercises || []).map((e, i) => ({
      ...e,
      order: e.order !== undefined ? e.order : i,
      prescription: planService.prescriptionOf(e),
    })),
  }));
}

/** Exactly one day should be `now`; if none is, promote the first non-done day. */
function ensureCurrentDay(days = []) {
  if (!days.length) return days;
  const hasNow = days.some((d) => d.status === 'now');
  if (hasNow) return days;
  const next = days.slice().sort((a, b) => a.dayIndex - b.dayIndex).find((d) => d.status !== 'done');
  if (next) next.status = 'now';
  return days;
}

/* ================================================================ */
/* TRAINING                                                          */
/* ================================================================ */

/* GET /api/plans/training/me — the caller's active plan */
exports.myTraining = asyncHandler(async (req, res) => {
  const { TrainingPlan } = require('../models');
  const plan = await TrainingPlan.findOne({ clientId: req.user._id, status: 'active' })
    .sort({ assignedAt: -1, updatedAt: -1 })
    .populate(POP);
  if (!plan) return ok(res, null, { hasPlan: false });
  return ok(res, serialiseTraining(plan), { hasPlan: true });
});

/* GET /api/plans/training?clientId= */
exports.listTraining = asyncHandler(async (req, res) => {
  const { TrainingPlan } = require('../models');
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
  const filter = {};

  if (req.user.role === 'client') {
    // A client can only ever list their own plans, whatever they asked for.
    filter.clientId = req.user._id;
  } else if (req.query.clientId) {
    // Controller-level ownership check, not just the route guard.
    await accessService.loadClientFor(req.user, req.query.clientId);
    filter.clientId = req.query.clientId;
  } else if (req.user.role === 'trainer') {
    filter.trainerId = req.user._id;
  }

  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

  const [rows, total] = await Promise.all([
    TrainingPlan.find(filter).populate(POP).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    TrainingPlan.countDocuments(filter),
  ]);
  return ok(res, rows.map(serialiseTraining), pageMeta({ page, limit }, total));
});

/* GET /api/plans/training/:id */
exports.getTraining = asyncHandler(async (req, res) => {
  const { TrainingPlan } = require('../models');
  const plan = await TrainingPlan.findById(req.params.id).populate(POP);
  accessService.assertPlanAccess(req.user, plan, 'read');
  return ok(res, serialiseTraining(plan));
});

/* POST /api/plans/training (trainer/admin) */
exports.createTraining = asyncHandler(async (req, res) => {
  const { TrainingPlan } = require('../models');
  const client = await accessService.loadClientFor(req.user, req.body.clientId);
  const trainerId = req.user.role === 'trainer'
    ? req.user._id
    : (client.clientProfile && client.clientProfile.trainerId) || req.user._id;

  const days = ensureCurrentDay(normaliseDays(req.body.days));
  const plan = await TrainingPlan.create({
    ...req.body,
    trainerId,
    days,
    assignedAt: req.body.status === 'active' ? new Date() : undefined,
  });
  await plan.populate(POP);

  const payload = serialiseTraining(plan);
  if (plan.status === 'active') await announceAssignment(req, 'training', plan, payload, client);
  else emitToCoach(payload.trainerId, 'plan:updated', { kind: 'training', plan: payload });

  return created(res, payload);
});

/* PUT /api/plans/training/:id (trainer/admin) -> plan:updated */
exports.updateTraining = asyncHandler(async (req, res) => {
  const { TrainingPlan } = require('../models');
  const plan = await TrainingPlan.findById(req.params.id);
  accessService.assertPlanAccess(req.user, plan, 'write');

  const wasActive = plan.status === 'active';
  Object.entries(req.body).forEach(([k, v]) => {
    if (k === 'days') plan.days = ensureCurrentDay(normaliseDays(v));
    else plan[k] = v;
  });
  if (!wasActive && plan.status === 'active' && !plan.assignedAt) plan.assignedAt = new Date();
  await plan.save();
  await plan.populate(POP);

  const payload = serialiseTraining(plan);
  if (!wasActive && plan.status === 'active') {
    const client = await accessService.loadClientFor(req.user, plan.clientId);
    await announceAssignment(req, 'training', plan, payload, client);
  } else {
    emitToUser(payload.clientId, 'plan:updated', { kind: 'training', plan: payload });
    emitToCoach(payload.trainerId, 'plan:updated', { kind: 'training', plan: payload });
    await notificationService.notify(payload.clientId, {
      type: 'plan_updated',
      title: 'Your training plan changed',
      body: `Coach updated '${plan.name}'.`,
      data: { kind: 'training', planId: String(plan._id) },
      deepLink: 'firon://train',
    });
  }
  return ok(res, payload);
});

/* POST /api/plans/training/:id/assign -> plan:assigned */
exports.assignTraining = asyncHandler(async (req, res) => {
  const { TrainingPlan } = require('../models');
  const plan = await TrainingPlan.findById(req.params.id);
  accessService.assertPlanAccess(req.user, plan, 'write');

  const client = await accessService.loadClientFor(req.user, plan.clientId);

  // Only one active training plan per client.
  await TrainingPlan.updateMany(
    { clientId: plan.clientId, status: 'active', _id: { $ne: plan._id } },
    { status: 'archived' },
  );
  plan.status = 'active';
  plan.assignedAt = new Date();
  plan.days = ensureCurrentDay(plan.days);
  await plan.save();
  await plan.populate(POP);

  const payload = serialiseTraining(plan);
  await announceAssignment(req, 'training', plan, payload, client);
  return ok(res, payload);
});

/* DELETE /api/plans/training/:id */
exports.removeTraining = asyncHandler(async (req, res) => {
  const { TrainingPlan } = require('../models');
  const plan = await TrainingPlan.findById(req.params.id);
  accessService.assertPlanAccess(req.user, plan, 'write');
  const { clientId, trainerId } = plan;
  await plan.deleteOne();

  emitToUser(clientId, 'plan:updated', { kind: 'training', plan: null, deletedId: String(req.params.id) });
  emitToCoach(trainerId, 'plan:updated', { kind: 'training', plan: null, deletedId: String(req.params.id) });
  return ok(res, { deleted: true, id: String(req.params.id) });
});

/**
 * PATCH /api/plans/training/:id/day/:dayIndex/exercise/:exIndex/toggle
 * Client check-off -> plan:progress to the coach.
 */
exports.toggleExercise = asyncHandler(async (req, res) => {
  const { TrainingPlan } = require('../models');
  const plan = await TrainingPlan.findById(req.params.id);
  accessService.assertIsPlanClient(req.user, plan);

  const dayIndex = Number(req.params.dayIndex);
  const exIndex = Number(req.params.exIndex);
  const day = plan.days.find((d) => d.dayIndex === dayIndex);
  if (!day) throw new ApiError(404, 'DAY_NOT_FOUND', `Day ${dayIndex} is not in this plan`);
  if (day.locked) throw new ApiError(403, 'DAY_LOCKED', 'That day is locked — it unlocks on schedule');
  const ex = day.exercises[exIndex];
  if (!ex) throw new ApiError(404, 'EXERCISE_NOT_FOUND', `Exercise ${exIndex} is not in that day`);

  const explicit = req.body && typeof req.body.done === 'boolean' ? req.body.done : null;
  ex.done = explicit !== null ? explicit : !ex.done;
  await plan.save();

  const { doneCount, total } = planService.dayCounts(day);
  const adherence = planService.adherencePct(plan);

  emitToCoach(plan.trainerId, 'plan:progress', {
    clientId: String(plan.clientId),
    planId: String(plan._id),
    dayIndex,
    doneCount,
    total,
    adherencePct: adherence,
  });

  return ok(res, {
    planId: String(plan._id),
    dayIndex,
    exIndex,
    done: ex.done,
    doneCount,
    total,
    adherencePct: adherence,
  });
});

/**
 * POST /api/plans/training/:id/day/:dayIndex/complete
 * Marks every exercise done, writes a SessionRecord + WorkoutLog rows,
 * promotes the next `todo` day to `now`, and emits session:completed +
 * plan:progress.
 */
exports.completeDay = asyncHandler(async (req, res) => {
  const { TrainingPlan, SessionRecord, WorkoutLog } = require('../models');
  const plan = await TrainingPlan.findById(req.params.id);
  accessService.assertIsPlanClient(req.user, plan);

  const dayIndex = Number(req.params.dayIndex);
  const day = plan.days.find((d) => d.dayIndex === dayIndex);
  if (!day) throw new ApiError(404, 'DAY_NOT_FOUND', `Day ${dayIndex} is not in this plan`);
  if (day.locked) throw new ApiError(403, 'DAY_LOCKED', 'That day is locked — it unlocks on schedule');

  const body = req.body || {};
  const now = new Date();
  const durationMin = body.durationMin || day.durationMin || 0;

  day.exercises.forEach((e) => { e.done = true; });
  day.status = 'done';
  day.completedAt = now;

  const nextDay = planService.advanceNextDay(plan, dayIndex);
  await plan.save();

  const dateStr = todayKey(now);

  const session = await SessionRecord.create({
    clientId: plan.clientId,
    trainerId: plan.trainerId,
    trainingPlanId: plan._id,
    dayIndex,
    title: day.title,
    scheduledAt: day.completedAt,
    completedAt: now,
    durationMin,
    status: 'completed',
  });

  if (day.exercises.length) {
    await WorkoutLog.insertMany(
      day.exercises.map((e) => ({
        userId: plan.clientId,
        trainingPlanId: plan._id,
        dayIndex,
        date: dateStr,
        exerciseName: e.name,
        sets: e.sets,
        reps: e.reps,
        weightKg: e.weightKg,
        notes: e.notes,
        source: e.loggedByClient ? 'manual' : 'plan',
        completed: true,
        durationMin,
      })),
      { ordered: false },
    );
  }

  const adherence = planService.adherencePct(plan);
  const payload = serialiseTraining(plan);
  const clientName = req.user.name;

  emitToCoach(plan.trainerId, 'session:completed', {
    clientId: String(plan.clientId),
    clientName,
    title: day.title,
    durationMin,
  });
  emitToCoach(plan.trainerId, 'plan:progress', {
    clientId: String(plan.clientId),
    planId: String(plan._id),
    dayIndex,
    doneCount: day.exercises.length,
    total: day.exercises.length,
    adherencePct: adherence,
  });
  emitToUser(plan.clientId, 'plan:updated', { kind: 'training', plan: payload });

  await notificationService.notify(plan.trainerId, {
    type: 'client_progress',
    title: 'Session completed',
    body: `${clientName} finished '${day.title}' (${durationMin} min).`,
    data: { clientId: String(plan.clientId), planId: String(plan._id), dayIndex },
    deepLink: `firon://clients/${plan.clientId}`,
  });

  logger.info({ planId: String(plan._id), dayIndex, clientId: String(plan.clientId) }, '[plan] day completed');

  return ok(res, {
    plan: payload,
    session: session.toJSON ? session.toJSON() : session,
    completedDay: { dayIndex, title: day.title, durationMin, exercises: day.exercises.length },
    nextDay: nextDay ? { dayIndex: nextDay.dayIndex, title: nextDay.title, status: nextDay.status } : null,
    adherencePct: adherence,
    weekSessions: { done: payload.doneDays, total: payload.totalDays },
  });
});

/**
 * POST /api/plans/training/:id/day/:dayIndex/log-exercise
 * The client logs something they did outside the plan -> client:log to the coach.
 */
exports.logExercise = asyncHandler(async (req, res) => {
  const { TrainingPlan, WorkoutLog } = require('../models');
  const plan = await TrainingPlan.findById(req.params.id);
  accessService.assertIsPlanClient(req.user, plan);

  const dayIndex = Number(req.params.dayIndex);
  const day = plan.days.find((d) => d.dayIndex === dayIndex);
  if (!day) throw new ApiError(404, 'DAY_NOT_FOUND', `Day ${dayIndex} is not in this plan`);

  const b = req.body;
  const entry = {
    exerciseId: b.exerciseId || undefined,
    name: b.name,
    sets: b.sets ?? undefined,
    reps: b.reps ?? undefined,
    weightKg: b.weightKg ?? undefined,
    notes: b.notes,
    done: true,
    loggedByClient: true,
    order: day.exercises.length,
  };
  entry.prescription = planService.prescriptionOf(entry);
  day.exercises.push(entry);
  await plan.save();

  const saved = day.exercises[day.exercises.length - 1];

  await WorkoutLog.create({
    userId: plan.clientId,
    trainingPlanId: plan._id,
    dayIndex,
    date: todayKey(),
    exerciseName: entry.name,
    sets: entry.sets,
    reps: entry.reps,
    weightKg: entry.weightKg,
    notes: entry.notes,
    source: 'manual',
    completed: true,
  });

  const { doneCount, total } = planService.dayCounts(day);

  emitToCoach(plan.trainerId, 'client:log', {
    clientId: String(plan.clientId),
    kind: 'exercise',
    payload: { name: entry.name, prescription: entry.prescription, dayIndex, planId: String(plan._id) },
  });
  emitToCoach(plan.trainerId, 'plan:progress', {
    clientId: String(plan.clientId),
    planId: String(plan._id),
    dayIndex,
    doneCount,
    total,
    adherencePct: planService.adherencePct(plan),
  });

  await notificationService.notify(plan.trainerId, {
    type: 'client_progress',
    title: 'Extra exercise logged',
    body: `${req.user.name} logged '${entry.name}' outside the plan.`,
    data: { clientId: String(plan.clientId), planId: String(plan._id), dayIndex },
    deepLink: `firon://clients/${plan.clientId}`,
  });

  return created(res, {
    planId: String(plan._id),
    dayIndex,
    exIndex: day.exercises.length - 1,
    exercise: saved.toJSON ? saved.toJSON() : saved,
    doneCount,
    total,
  });
});

/* ================================================================ */
/* DIET                                                              */
/* ================================================================ */

/* GET /api/plans/diet/me */
exports.myDiet = asyncHandler(async (req, res) => {
  const { DietPlan } = require('../models');
  const plan = await DietPlan.findOne({ clientId: req.user._id, status: 'active' })
    .sort({ assignedAt: -1, updatedAt: -1 })
    .populate(POP);
  if (!plan) return ok(res, null, { hasPlan: false });
  return ok(res, serialiseDiet(plan), { hasPlan: true });
});

/* GET /api/plans/diet?clientId= */
exports.listDiet = asyncHandler(async (req, res) => {
  const { DietPlan } = require('../models');
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
  const filter = {};

  if (req.user.role === 'client') filter.clientId = req.user._id;
  else if (req.query.clientId) {
    await accessService.loadClientFor(req.user, req.query.clientId);
    filter.clientId = req.query.clientId;
  } else if (req.user.role === 'trainer') filter.trainerId = req.user._id;

  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

  const [rows, total] = await Promise.all([
    DietPlan.find(filter).populate(POP).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    DietPlan.countDocuments(filter),
  ]);
  return ok(res, rows.map(serialiseDiet), pageMeta({ page, limit }, total));
});

/* GET /api/plans/diet/:id */
exports.getDiet = asyncHandler(async (req, res) => {
  const { DietPlan } = require('../models');
  const plan = await DietPlan.findById(req.params.id).populate(POP);
  accessService.assertPlanAccess(req.user, plan, 'read');
  return ok(res, serialiseDiet(plan));
});

/* POST /api/plans/diet (trainer/admin) */
exports.createDiet = asyncHandler(async (req, res) => {
  const { DietPlan } = require('../models');
  const client = await accessService.loadClientFor(req.user, req.body.clientId);
  const trainerId = req.user.role === 'trainer'
    ? req.user._id
    : (client.clientProfile && client.clientProfile.trainerId) || req.user._id;

  const meals = (req.body.meals || []).map((m, i) => ({ ...m, order: m.order !== undefined ? m.order : i }));
  const plan = await DietPlan.create({
    ...req.body,
    meals,
    trainerId,
    assignedAt: req.body.status === 'active' ? new Date() : undefined,
  });
  await plan.populate(POP);

  const payload = serialiseDiet(plan);
  if (plan.status === 'active') await announceAssignment(req, 'diet', plan, payload, client);
  else emitToCoach(payload.trainerId, 'plan:updated', { kind: 'diet', plan: payload });

  return created(res, payload);
});

/* PUT /api/plans/diet/:id */
exports.updateDiet = asyncHandler(async (req, res) => {
  const { DietPlan } = require('../models');
  const plan = await DietPlan.findById(req.params.id);
  accessService.assertPlanAccess(req.user, plan, 'write');

  const wasActive = plan.status === 'active';
  Object.entries(req.body).forEach(([k, v]) => {
    if (k === 'meals') plan.meals = v.map((m, i) => ({ ...m, order: m.order !== undefined ? m.order : i }));
    else plan[k] = v;
  });
  if (!wasActive && plan.status === 'active' && !plan.assignedAt) plan.assignedAt = new Date();
  await plan.save();
  await plan.populate(POP);

  const payload = serialiseDiet(plan);
  if (!wasActive && plan.status === 'active') {
    const client = await accessService.loadClientFor(req.user, plan.clientId);
    await announceAssignment(req, 'diet', plan, payload, client);
  } else {
    emitToUser(payload.clientId, 'plan:updated', { kind: 'diet', plan: payload });
    emitToCoach(payload.trainerId, 'plan:updated', { kind: 'diet', plan: payload });
    await notificationService.notify(payload.clientId, {
      type: 'plan_updated',
      title: 'Your nutrition plan changed',
      body: `Coach updated '${plan.name}'.`,
      data: { kind: 'diet', planId: String(plan._id) },
      deepLink: 'firon://nutrition',
    });
  }
  return ok(res, payload);
});

/* POST /api/plans/diet/:id/assign */
exports.assignDiet = asyncHandler(async (req, res) => {
  const { DietPlan } = require('../models');
  const plan = await DietPlan.findById(req.params.id);
  accessService.assertPlanAccess(req.user, plan, 'write');
  const client = await accessService.loadClientFor(req.user, plan.clientId);

  await DietPlan.updateMany(
    { clientId: plan.clientId, status: 'active', _id: { $ne: plan._id } },
    { status: 'archived' },
  );
  plan.status = 'active';
  plan.assignedAt = new Date();
  await plan.save();
  await plan.populate(POP);

  const payload = serialiseDiet(plan);
  await announceAssignment(req, 'diet', plan, payload, client);
  return ok(res, payload);
});

/* DELETE /api/plans/diet/:id */
exports.removeDiet = asyncHandler(async (req, res) => {
  const { DietPlan } = require('../models');
  const plan = await DietPlan.findById(req.params.id);
  accessService.assertPlanAccess(req.user, plan, 'write');
  const { clientId, trainerId } = plan;
  await plan.deleteOne();

  emitToUser(clientId, 'plan:updated', { kind: 'diet', plan: null, deletedId: String(req.params.id) });
  emitToCoach(trainerId, 'plan:updated', { kind: 'diet', plan: null, deletedId: String(req.params.id) });
  return ok(res, { deleted: true, id: String(req.params.id) });
});

/**
 * PATCH /api/plans/diet/:id/meal/:index/toggle
 * Client ticks a meal off -> a MealLog row + client:log to the coach.
 */
exports.toggleMeal = asyncHandler(async (req, res) => {
  const { DietPlan, MealLog } = require('../models');
  const plan = await DietPlan.findById(req.params.id);
  accessService.assertIsPlanClient(req.user, plan);

  const index = Number(req.params.index);
  const meal = plan.meals[index];
  if (!meal) throw new ApiError(404, 'MEAL_NOT_FOUND', `Meal ${index} is not in this plan`);

  const date = todayKey();
  const existing = await MealLog.findOne({
    userId: plan.clientId, dietPlanId: plan._id, date, slot: meal.slot, source: 'plan',
  });

  const explicit = req.body && typeof req.body.done === 'boolean' ? req.body.done : null;
  const consumed = explicit !== null ? explicit : !(existing && existing.consumed);

  const log = await MealLog.findOneAndUpdate(
    { userId: plan.clientId, dietPlanId: plan._id, date, slot: meal.slot, source: 'plan' },
    {
      $set: {
        food: meal.food,
        kcal: meal.kcal,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        consumed,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  const consumedToday = await MealLog.find({ userId: plan.clientId, date, consumed: true }).lean();
  const kcalToday = consumedToday.reduce((a, m) => a + (m.kcal || 0), 0);

  emitToCoach(plan.trainerId, 'client:log', {
    clientId: String(plan.clientId),
    kind: 'meal',
    payload: { slot: meal.slot, food: meal.food, kcal: meal.kcal, consumed, date },
  });

  return ok(res, {
    planId: String(plan._id),
    index,
    slot: meal.slot,
    consumed: !!log.consumed,
    kcalToday,
    targetKcal: plan.kcal || planService.dietTotals(plan).kcal,
  });
});

/* POST /api/plans/diet/log-meal — a free-text meal the client ate */
exports.logMeal = asyncHandler(async (req, res) => {
  const { MealLog, DietPlan } = require('../models');
  const date = req.body.date || todayKey();

  let dietPlanId = req.body.dietPlanId || undefined;
  if (!dietPlanId) {
    const active = await DietPlan.findOne({ clientId: req.user._id, status: 'active' }).select('_id trainerId').lean();
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

  const consumedToday = await MealLog.find({ userId: req.user._id, date, consumed: true }).lean();

  return created(res, {
    log: log.toJSON ? log.toJSON() : log,
    kcalToday: consumedToday.reduce((a, m) => a + (m.kcal || 0), 0),
  });
});

/* -------------------------------------------------------- helpers */

/** plan:assigned to the client + a notification (CONTRACT §6/§7). */
async function announceAssignment(req, kind, plan, payload, client) {
  // `payload.clientId`/`payload.trainerId` are plain id strings even when the
  // plan document was populated, so they are what the rooms are keyed on.
  emitToUser(payload.clientId, 'plan:assigned', { kind, plan: payload });
  emitToCoach(payload.trainerId, 'plan:updated', { kind, plan: payload });

  const coachName = String(req.user.name || 'Your coach').split(' ')[0];
  await notificationService.notify(payload.clientId, {
    type: 'plan_assigned',
    title: kind === 'training' ? 'New training plan' : 'New nutrition plan',
    body: `Coach ${coachName} assigned you '${plan.name}'.`,
    data: { kind, planId: String(plan._id) },
    deepLink: kind === 'training' ? 'firon://train' : 'firon://nutrition',
  });
  logger.info(
    { kind, planId: String(plan._id), clientId: String(plan.clientId) },
    '[plan] assigned',
  );
  return client;
}

exports.serialiseTraining = serialiseTraining;
exports.serialiseDiet = serialiseDiet;
