'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok } = require('../utils/respond');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { escapeRegex, initials } = require('../utils/text');
const { absoluteUrl } = require('../utils/urls');
const planService = require('../services/planService');
const accessService = require('../services/accessService');
const notificationService = require('../services/notificationService');
const { emitToCoach } = require('../realtime/emit');

/** Start of the current ISO week (Monday 00:00 local). */
function weekStart(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * GET /api/clients — the trainer's roster.
 * adherencePct comes from the active TrainingPlan; status maps it to the
 * prototype's colour thresholds: no active plan -> 'new', <70 -> 'warn',
 * otherwise 'ok' (the CMS/app colours >=80 lime, 70-79 amber, <70 danger).
 */
exports.roster = asyncHandler(async (req, res) => {
  const { User, TrainingPlan, DietPlan } = require('../models');
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 100 });

  const trainerId = req.user.role === 'admin' && req.query.trainerId
    ? req.query.trainerId
    : req.user._id;

  const filter = { role: 'client', 'clientProfile.trainerId': trainerId };
  if (req.user.role === 'admin' && !req.query.trainerId) delete filter['clientProfile.trainerId'];
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const [clients, total] = await Promise.all([
    User.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const clientIds = clients.map((c) => c._id);
  const [trainingPlans, dietPlans] = await Promise.all([
    TrainingPlan.find({ clientId: { $in: clientIds }, status: 'active' }).lean(),
    DietPlan.find({ clientId: { $in: clientIds }, status: 'active' }).lean(),
  ]);

  const trainingBy = {};
  trainingPlans.forEach((p) => { trainingBy[String(p.clientId)] = p; });
  const dietBy = {};
  dietPlans.forEach((p) => { dietBy[String(p.clientId)] = p; });

  let rows = clients.map((c) => {
    const plan = trainingBy[String(c._id)];
    const diet = dietBy[String(c._id)];
    const adherencePct = plan ? planService.adherencePct(plan) : 0;
    return {
      id: String(c._id),
      name: c.name,
      initials: initials(c.name),
      email: c.email,
      phone: c.phone,
      avatarUrl: c.avatarUrl ? absoluteUrl(req, c.avatarUrl) : null,
      planLabel: plan ? planService.planLabel(plan) : 'Onboarding',
      trainingPlanId: plan ? String(plan._id) : null,
      adherencePct,
      status: planService.rosterStatus({ hasActivePlan: !!plan, adherence: adherencePct }),
      onboardingCompleted: !!(c.clientProfile && c.clientProfile.onboardingCompleted),
      goal: (c.clientProfile && c.clientProfile.goal) || null,
      membershipLabel: (c.clientProfile && c.clientProfile.membershipLabel) || 'Premium plan',
      dietPlanSummary: diet
        ? {
          id: String(diet._id),
          name: diet.name,
          kcal: diet.kcal || planService.dietTotals(diet).kcal,
          protein: diet.protein || 0,
          carbs: diet.carbs || 0,
          fat: diet.fat || 0,
          meals: (diet.meals || []).length,
        }
        : null,
    };
  });

  if (req.query.status && req.query.status !== 'all') {
    rows = rows.filter((r) => r.status === req.query.status);
  }

  return ok(res, rows, pageMeta({ page, limit }, total));
});

/* GET /api/clients/stats — the PT roster header tiles */
exports.stats = asyncHandler(async (req, res) => {
  const { User, TrainingPlan, SessionRecord } = require('../models');
  const trainerId = req.user.role === 'admin' && req.query.trainerId ? req.query.trainerId : req.user._id;
  const scope = req.user.role === 'admin' && !req.query.trainerId ? {} : { 'clientProfile.trainerId': trainerId };

  const clients = await User.find({ role: 'client', isActive: true, ...scope }).select('_id clientProfile').lean();
  const clientIds = clients.map((c) => c._id);

  const plans = await TrainingPlan.find({ clientId: { $in: clientIds }, status: 'active' }).lean();
  const withPlan = new Set(plans.map((p) => String(p.clientId)));

  const sessionsThisWeek = await SessionRecord.countDocuments({
    clientId: { $in: clientIds },
    status: 'completed',
    completedAt: { $gte: weekStart() },
  });

  const rated = plans.map((p) => planService.adherencePct(p));
  const avgAdherence = rated.length ? Math.round(rated.reduce((a, b) => a + b, 0) / rated.length) : 0;

  return ok(res, {
    activeClients: clientIds.filter((id) => withPlan.has(String(id))).length,
    totalClients: clientIds.length,
    sessionsThisWeek,
    // "New requests" = clients on the roster with no active plan yet.
    newRequests: clientIds.length - withPlan.size,
    avgAdherence,
  });
});

/* GET /api/clients/:id — full detail for the client sheet */
exports.detail = asyncHandler(async (req, res) => {
  const { TrainingPlan, DietPlan, SessionRecord, WorkoutLog, MealLog } = require('../models');
  const client = await accessService.loadClientFor(req.user, req.params.id);

  const [trainingPlan, dietPlan, sessions, workoutLogs, mealLogs] = await Promise.all([
    TrainingPlan.findOne({ clientId: client._id, status: 'active' }).sort({ assignedAt: -1 }).lean(),
    DietPlan.findOne({ clientId: client._id, status: 'active' }).sort({ assignedAt: -1 }).lean(),
    SessionRecord.find({ clientId: client._id }).sort({ completedAt: -1, createdAt: -1 }).limit(20).lean(),
    WorkoutLog.find({ userId: client._id }).sort({ createdAt: -1 }).limit(20).lean(),
    MealLog.find({ userId: client._id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  const adherencePct = trainingPlan ? planService.adherencePct(trainingPlan) : 0;
  const completed = sessions.filter((s) => s.status === 'completed');
  const cp = client.clientProfile || {};
  const weightChange = cp.startWeightKg && cp.weightKg
    ? Math.round((cp.weightKg - cp.startWeightKg) * 10) / 10
    : null;

  const planCtrl = require('./plan.controller');

  return ok(res, {
    client: {
      id: String(client._id),
      name: client.name,
      initials: initials(client.name),
      email: client.email,
      phone: client.phone,
      avatarUrl: client.avatarUrl ? absoluteUrl(req, client.avatarUrl) : null,
      isVerified: client.isVerified,
      lastLoginAt: client.lastLoginAt,
      clientProfile: cp,
      bmi: cp.heightCm && cp.weightKg
        ? Math.round((cp.weightKg / ((cp.heightCm / 100) ** 2)) * 10) / 10
        : null,
    },
    stats: {
      adherencePct,
      status: planService.rosterStatus({ hasActivePlan: !!trainingPlan, adherence: adherencePct }),
      weekNumber: trainingPlan ? trainingPlan.weekNumber || null : null,
      sessionsCompleted: completed.length,
      sessionsThisWeek: completed.filter((s) => s.completedAt && s.completedAt >= weekStart()).length,
      weeklyTarget: cp.sessionsPerWeek || (trainingPlan ? (trainingPlan.days || []).length : 0),
      weightChangeKg: weightChange,
      lastActive: client.lastLoginAt,
      daysDone: trainingPlan ? (trainingPlan.days || []).filter((d) => d.status === 'done').length : 0,
      daysTotal: trainingPlan ? (trainingPlan.days || []).length : 0,
    },
    trainingPlan: trainingPlan ? planCtrl.serialiseTraining(trainingPlan) : null,
    dietPlan: dietPlan ? planCtrl.serialiseDiet(dietPlan) : null,
    recentLogs: {
      sessions: sessions.map((s) => ({ ...s, id: String(s._id) })),
      workouts: workoutLogs.map((w) => ({ ...w, id: String(w._id) })),
      meals: mealLogs.map((m) => ({ ...m, id: String(m._id) })),
    },
  });
});

/* POST /api/clients/:id/assign-trainer (admin) */
exports.assignTrainer = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const client = await User.findById(req.params.id);
  if (!client) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'That client does not exist');
  if (client.role !== 'client') throw new ApiError(400, 'NOT_A_CLIENT', 'That user is not a client');

  const trainer = await User.findById(req.body.trainerId);
  if (!trainer || trainer.role !== 'trainer') {
    throw new ApiError(404, 'TRAINER_NOT_FOUND', 'That trainer does not exist');
  }

  const previousTrainerId = client.clientProfile && client.clientProfile.trainerId;
  client.clientProfile = { ...(client.clientProfile || {}), trainerId: trainer._id };
  await client.save();

  if (previousTrainerId && String(previousTrainerId) !== String(trainer._id)) {
    emitToCoach(previousTrainerId, 'roster:updated', { trainerId: String(previousTrainerId) });
  }
  emitToCoach(trainer._id, 'roster:updated', { trainerId: String(trainer._id) });

  await notificationService.notify(trainer._id, {
    type: 'new_client',
    title: 'New client assigned',
    body: `${client.name} was added to your roster.`,
    data: { clientId: String(client._id) },
    deepLink: `firon://clients/${client._id}`,
  });

  return ok(res, {
    clientId: String(client._id),
    trainerId: String(trainer._id),
    trainerName: trainer.name,
  });
});
