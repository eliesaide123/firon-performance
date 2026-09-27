'use strict';

const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok } = require('../utils/respond');
const { todayKey } = require('../utils/text');
const { publicUser, populateTrainer } = require('./auth.controller');
const { emitToCoach } = require('../realtime/emit');

/* GET /api/profile */
exports.get = asyncHandler(async (req, res) => {
  const trainer = await populateTrainer(req.user);
  const user = publicUser(req, req.user, { trainer });
  const cp = req.user.clientProfile || {};
  return ok(res, {
    ...user,
    bmi: cp.heightCm && cp.weightKg
      ? Math.round((cp.weightKg / ((cp.heightCm / 100) ** 2)) * 10) / 10
      : null,
  });
});

/* PUT /api/profile — name / email / phone / avatar / locale */
exports.update = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const { name, email, phone, avatarUrl, locale } = req.body;

  if (email && email !== req.user.email) {
    const taken = await User.findOne({ email, _id: { $ne: req.user._id } });
    if (taken) throw new ApiError(409, 'EMAIL_IN_USE', 'Another account already uses that email');
    req.user.email = email;
  }
  if (phone !== undefined && phone !== req.user.phone) {
    const taken = await User.findOne({ phone, _id: { $ne: req.user._id } });
    if (taken) throw new ApiError(409, 'PHONE_IN_USE', 'Another account already uses that phone');
    req.user.phone = phone;
  }
  if (name !== undefined) req.user.name = name;
  if (avatarUrl !== undefined) req.user.avatarUrl = avatarUrl;
  if (locale !== undefined) req.user.locale = locale;

  await req.user.save();

  const trainerId = req.user.clientProfile && req.user.clientProfile.trainerId;
  if (req.user.role === 'client' && trainerId) {
    emitToCoach(trainerId, 'roster:updated', { trainerId: String(trainerId) });
  }

  const trainer = await populateTrainer(req.user);
  return ok(res, publicUser(req, req.user, { trainer }));
});

/**
 * PUT /api/profile/client-details
 * The onboarding body-stats + goals payload. Validation matches the
 * prototype's saveMyDetails(): height 100-250cm, weight 30-300kg.
 * Sets onboardingCompleted: true.
 */
exports.updateClientDetails = asyncHandler(async (req, res) => {
  if (req.user.role !== 'client') {
    throw new ApiError(403, 'CLIENT_ONLY', 'Only a client profile has body stats');
  }

  const cp = req.user.clientProfile || {};
  const next = { ...(cp.toObject ? cp.toObject() : cp) };

  Object.entries(req.body).forEach(([k, v]) => {
    next[k] = v === null ? undefined : v;
  });

  // Remember the very first weight so progress can be measured against it.
  if (!next.startWeightKg && req.body.weightKg) next.startWeightKg = req.body.weightKg;
  next.onboardingCompleted = true;

  req.user.clientProfile = next;
  req.user.markModified('clientProfile');
  await req.user.save();

  const trainerId = next.trainerId;
  if (trainerId) {
    emitToCoach(trainerId, 'roster:updated', { trainerId: String(trainerId) });
    emitToCoach(trainerId, 'client:log', {
      clientId: String(req.user._id),
      kind: 'exercise',
      payload: {
        name: 'Profile updated',
        detail: `${next.heightCm}cm · ${next.weightKg}kg · goal ${next.goal || '—'}`,
      },
    });
  }

  const trainer = await populateTrainer(req.user);
  const user = publicUser(req, req.user, { trainer });
  return ok(res, {
    ...user,
    bmi: Math.round((next.weightKg / ((next.heightCm / 100) ** 2)) * 10) / 10,
    onboardingCompleted: true,
  });
});

/* GET /api/profile/progress */
exports.progress = asyncHandler(async (req, res) => {
  const { SessionRecord, WorkoutLog, MealLog, TrainingPlan, VideoProgress } = require('../models');
  const userId = req.user._id;
  const cp = req.user.clientProfile || {};

  const since = new Date();
  since.setDate(since.getDate() - 28);

  const [sessions, workouts, meals, plan, videos] = await Promise.all([
    SessionRecord.find({ clientId: userId, status: 'completed' }).sort({ completedAt: -1 }).limit(60).lean(),
    WorkoutLog.countDocuments({ userId }),
    MealLog.find({ userId, date: todayKey(), consumed: true }).lean(),
    TrainingPlan.findOne({ clientId: userId, status: 'active' }).lean(),
    VideoProgress.countDocuments({ userId, progress: { $gte: 0.9 } }),
  ]);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const planService = require('../services/planService');

  return ok(res, {
    weightKg: cp.weightKg || null,
    startWeightKg: cp.startWeightKg || null,
    targetWeightKg: cp.targetWeightKg || null,
    weightChangeKg: cp.startWeightKg && cp.weightKg
      ? Math.round((cp.weightKg - cp.startWeightKg) * 10) / 10
      : null,
    bmi: cp.heightCm && cp.weightKg
      ? Math.round((cp.weightKg / ((cp.heightCm / 100) ** 2)) * 10) / 10
      : null,
    bodyFatPct: cp.bodyFatPct || null,
    waistCm: cp.waistCm || null,
    sessionsCompleted: sessions.length,
    sessionsThisWeek: sessions.filter((s) => s.completedAt && s.completedAt >= weekAgo).length,
    weeklyTarget: cp.sessionsPerWeek || 0,
    exercisesLogged: workouts,
    videosCompleted: videos,
    kcalToday: meals.reduce((a, m) => a + (m.kcal || 0), 0),
    planProgressPct: plan ? planService.adherencePct(plan) : 0,
    recentSessions: sessions.slice(0, 10).map((s) => ({
      id: String(s._id), title: s.title, completedAt: s.completedAt, durationMin: s.durationMin,
    })),
  });
});

/* PUT /api/profile/password */
exports.changePassword = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const user = await User.findById(req.user._id).select('+passwordHash');
  const match = await bcrypt.compare(req.body.currentPassword, user.passwordHash || '');
  if (!match) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Current password is wrong');

  user.passwordHash = await bcrypt.hash(req.body.password, 10);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  const tokenService = require('../services/tokenService');
  return ok(res, { changed: true, ...tokenService.issuePair(user) });
});
