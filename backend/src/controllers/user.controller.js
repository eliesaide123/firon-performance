'use strict';

const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { escapeRegex, initials } = require('../utils/text');
const { absoluteUrl } = require('../utils/urls');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { emitToCoach, disconnectUser } = require('../realtime/emit');

const BCRYPT_COST = 10;

/**
 * Admin-side user administration (/api/users).
 * `/api/clients` remains the TRAINER-side roster view; this is the CMS surface.
 */
function serialise(req, user, { trainer } = {}) {
  const u = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  if (u._id && !u.id) { u.id = String(u._id); delete u._id; }
  delete u.__v;
  delete u.passwordHash;
  u.initials = u.initials || initials(u.name);
  if (u.avatarUrl) u.avatarUrl = absoluteUrl(req, u.avatarUrl);
  // Never expose raw device tokens through the CMS.
  u.fcmTokenCount = Array.isArray(u.fcmTokens) ? u.fcmTokens.length : 0;
  delete u.fcmTokens;

  const cp = u.clientProfile || {};
  if (u.role === 'client' && cp.heightCm && cp.weightKg) {
    u.bmi = Math.round((cp.weightKg / ((cp.heightCm / 100) ** 2)) * 10) / 10;
  }
  if (cp.trainerId) u.clientProfile.trainerId = String(cp.trainerId);

  if (trainer) {
    u.trainer = {
      id: String(trainer._id || trainer.id),
      name: trainer.name,
      email: trainer.email,
      avatarUrl: trainer.avatarUrl ? absoluteUrl(req, trainer.avatarUrl) : null,
      title: (trainer.trainerProfile && trainer.trainerProfile.title) || null,
    };
  }
  return u;
}

const idOf = (v) => String((v && (v._id || v.id)) || v || '');

/** Merges a sub-document patch, treating explicit null as "clear this field". */
function mergeSubDoc(current, patch) {
  const base = current && current.toObject ? current.toObject() : { ...(current || {}) };
  delete base.id;
  Object.entries(patch).forEach(([k, v]) => {
    if (v === null) delete base[k];
    else base[k] = v;
  });
  return base;
}

const SORTS = { name: { name: 1 }, newest: { createdAt: -1 }, lastLogin: { lastLoginAt: -1 } };

/* GET /api/users */
exports.list = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 25 });

  const filter = {};
  if (req.query.role && req.query.role !== 'all') filter.role = req.query.role;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive;
  if (req.query.isVerified !== undefined) filter.isVerified = req.query.isVerified;
  if (req.query.trainerId) filter['clientProfile.trainerId'] = req.query.trainerId;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const [rows, total] = await Promise.all([
    User.find(filter)
      .populate('clientProfile.trainerId', 'name email avatarUrl trainerProfile.title')
      .sort(SORTS[req.query.sort] || SORTS.name)
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const data = rows.map((u) => {
    const trainerDoc = u.clientProfile && u.clientProfile.trainerId;
    const trainer = trainerDoc && trainerDoc.name ? trainerDoc : null;
    const out = serialise(req, u, { trainer });
    if (trainer && out.clientProfile) out.clientProfile.trainerId = String(trainer._id);
    return out;
  });

  return ok(res, data, pageMeta({ page, limit }, total));
});

/* GET /api/users/:id */
exports.get = asyncHandler(async (req, res) => {
  const { User, TrainingPlan, DietPlan } = require('../models');
  const user = await User.findById(req.params.id)
    .populate('clientProfile.trainerId', 'name email avatarUrl trainerProfile.title');
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'That user does not exist');

  const trainerDoc = user.clientProfile && user.clientProfile.trainerId;
  const trainer = trainerDoc && trainerDoc.name ? trainerDoc : null;
  const payload = serialise(req, user, { trainer });
  if (trainer && payload.clientProfile) payload.clientProfile.trainerId = String(trainer._id);

  if (user.role === 'client') {
    const [training, diet] = await Promise.all([
      TrainingPlan.findOne({ clientId: user._id, status: 'active' }).select('name weekNumber status').lean(),
      DietPlan.findOne({ clientId: user._id, status: 'active' }).select('name kcal status').lean(),
    ]);
    payload.activePlans = {
      training: training ? { id: String(training._id), name: training.name, weekNumber: training.weekNumber } : null,
      diet: diet ? { id: String(diet._id), name: diet.name, kcal: diet.kcal } : null,
    };
  }
  if (user.role === 'trainer') {
    payload.clientCount = await User.countDocuments({ role: 'client', 'clientProfile.trainerId': user._id });
  }

  return ok(res, payload);
});

/* POST /api/users — an admin-created account is verified + active (no OTP) */
exports.create = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const { name, email, phone, password, role, avatarUrl, locale, clientProfile, trainerProfile } = req.body;

  if (await User.findOne({ email })) {
    throw new ApiError(409, 'DUPLICATE_EMAIL', 'An account with that email already exists');
  }
  if (phone && await User.findOne({ phone })) {
    throw new ApiError(409, 'DUPLICATE_PHONE', 'An account with that phone already exists');
  }
  if (clientProfile && clientProfile.trainerId) await assertTrainer(clientProfile.trainerId);

  const user = await User.create({
    name,
    email,
    phone,
    passwordHash: await bcrypt.hash(password, BCRYPT_COST),
    role,
    avatarUrl,
    locale: locale || 'en',
    // Created by a human admin, so it skips the OTP gate entirely.
    isVerified: true,
    isActive: true,
    clientProfile: role === 'client' ? { onboardingCompleted: false, ...(clientProfile || {}) } : {},
    trainerProfile: role === 'trainer' ? (trainerProfile || {}) : {},
  });

  const newTrainerId = role === 'client' && clientProfile && clientProfile.trainerId;
  if (newTrainerId) await announceRosterChange(newTrainerId, user, 'assigned');

  logger.info({ userId: String(user._id), role, by: String(req.user._id) }, '[users] created');
  return created(res, serialise(req, user));
});

/* PUT /api/users/:id */
exports.update = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'That user does not exist');

  const b = req.body;

  if (b.email && b.email !== user.email) {
    if (await User.findOne({ email: b.email, _id: { $ne: user._id } })) {
      throw new ApiError(409, 'DUPLICATE_EMAIL', 'Another account already uses that email');
    }
    user.email = b.email;
  }
  if (b.phone !== undefined) {
    if (b.phone && await User.findOne({ phone: b.phone, _id: { $ne: user._id } })) {
      throw new ApiError(409, 'DUPLICATE_PHONE', 'Another account already uses that phone');
    }
    user.phone = b.phone || undefined;
  }
  if (b.name !== undefined) user.name = b.name;
  if (b.avatarUrl !== undefined) user.avatarUrl = b.avatarUrl || undefined;
  if (b.locale !== undefined) user.locale = b.locale;
  if (b.isVerified !== undefined) user.isVerified = b.isVerified;

  const previousTrainerId = idOf(user.clientProfile && user.clientProfile.trainerId);

  if (b.clientProfile) {
    if (b.clientProfile.trainerId) await assertTrainer(b.clientProfile.trainerId);
    user.clientProfile = mergeSubDoc(user.clientProfile, b.clientProfile);
    user.markModified('clientProfile');
  }
  if (b.trainerProfile) {
    user.trainerProfile = mergeSubDoc(user.trainerProfile, b.trainerProfile);
    user.markModified('trainerProfile');
  }

  await user.save();
  // Re-populate so PUT returns the same shape as GET (CMS renders it directly).
  await user.populate({ path: 'clientProfile.trainerId', select: 'name email avatarUrl trainerProfile.title' });

  const nextTrainerId = idOf(user.clientProfile && user.clientProfile.trainerId);
  if (nextTrainerId !== previousTrainerId) {
    if (previousTrainerId) emitToCoach(previousTrainerId, 'roster:updated', { trainerId: previousTrainerId });
    if (nextTrainerId) await announceRosterChange(nextTrainerId, user, 'assigned');
  } else if (nextTrainerId) {
    emitToCoach(nextTrainerId, 'roster:updated', { trainerId: nextTrainerId });
  }

  const trainerDoc = user.clientProfile && user.clientProfile.trainerId;
  const trainer = trainerDoc && trainerDoc.name ? trainerDoc : null;
  const payload = serialise(req, user, { trainer });
  if (trainer && payload.clientProfile) payload.clientProfile.trainerId = String(trainer._id);
  return ok(res, payload);
});

/* PATCH /api/users/:id/active — deactivating kills every live token */
exports.setActive = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'That user does not exist');

  const { isActive } = req.body;

  if (!isActive) {
    if (idOf(user) === idOf(req.user)) {
      throw new ApiError(403, 'FORBIDDEN', 'You cannot deactivate your own account');
    }
    await assertNotLastAdmin(user);
  }

  user.isActive = isActive;
  // Bump tokenVersion so existing access + refresh tokens stop working at once.
  if (!isActive) user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  const trainerId = idOf(user.clientProfile && user.clientProfile.trainerId);
  if (user.role === 'client' && trainerId) emitToCoach(trainerId, 'roster:updated', { trainerId });

  // Deactivation must be felt immediately, not on the user's next API call. Push the reason to
  // every device they have open, then drop those sockets. Both clients render the message from
  // the CMS `account.deactivated_*` keys and route back to the login screen.
  let disconnected = 0;
  if (!isActive) {
    disconnected = await disconnectUser(user._id, 'account:deactivated', {
      userId: String(user._id),
      reason: 'deactivated',
      at: new Date().toISOString(),
    });
  }

  logger.info(
    { userId: String(user._id), isActive, by: String(req.user._id), socketsDisconnected: disconnected },
    '[users] active changed',
  );
  return ok(res, {
    id: String(user._id),
    isActive: user.isActive,
    tokenVersion: user.tokenVersion,
    // Tells the admin whether the person was actually online to receive it.
    socketsDisconnected: disconnected,
  });
});

/* POST /api/users/:id/reset-password */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const user = await User.findById(req.params.id).select('+passwordHash');
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'That user does not exist');

  user.passwordHash = await bcrypt.hash(req.body.password, BCRYPT_COST);
  // Every existing session is invalidated by the reset.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  logger.info({ userId: String(user._id), by: String(req.user._id) }, '[users] password reset by admin');
  return ok(res, { id: String(user._id), passwordReset: true, sessionsRevoked: true });
});

/* DELETE /api/users/:id — soft delete (isActive:false), never a hard delete */
exports.remove = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'That user does not exist');

  if (idOf(user) === idOf(req.user)) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot delete your own account');
  }
  await assertNotLastAdmin(user);

  user.isActive = false;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  const trainerId = idOf(user.clientProfile && user.clientProfile.trainerId);
  if (user.role === 'client' && trainerId) emitToCoach(trainerId, 'roster:updated', { trainerId });

  logger.info({ userId: String(user._id), by: String(req.user._id) }, '[users] soft-deleted');
  return ok(res, { deleted: true, softDeleted: true, id: String(user._id), isActive: false });
});

/* -------------------------------------------------------- helpers */

async function assertTrainer(trainerId) {
  const { User } = require('../models');
  const trainer = await User.findById(trainerId).select('role isActive');
  if (!trainer || trainer.role !== 'trainer') {
    throw new ApiError(404, 'TRAINER_NOT_FOUND', 'That trainer does not exist');
  }
  if (!trainer.isActive) throw new ApiError(400, 'TRAINER_INACTIVE', 'That trainer is deactivated');
  return trainer;
}

/** Refuses to disable/delete the only remaining active admin. */
async function assertNotLastAdmin(user) {
  if (user.role !== 'admin') return;
  const { User } = require('../models');
  const others = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: user._id } });
  if (others === 0) {
    throw new ApiError(403, 'FORBIDDEN', 'This is the last active admin — promote another admin first');
  }
}

/** roster:updated to the coach + a notification about the new client. */
async function announceRosterChange(trainerId, client, action) {
  emitToCoach(trainerId, 'roster:updated', { trainerId: String(trainerId) });
  if (action !== 'assigned') return;
  await notificationService.notify(trainerId, {
    type: 'new_client',
    title: 'New client assigned',
    body: `${client.name} was added to your roster.`,
    data: { clientId: String(client._id) },
    deepLink: `firon://clients/${client._id}`,
  });
}

exports.serialise = serialise;
