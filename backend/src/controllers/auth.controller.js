'use strict';

const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const logger = require('../utils/logger');
const tokenService = require('../services/tokenService');
const otpService = require('../services/otpService');
const notificationService = require('../services/notificationService');
const { absoluteUrl } = require('../utils/urls');
const { EMAIL_RE } = require('../validators/auth.validators');

const BCRYPT_COST = 10;

/** Everything the apps need to route + render the signed-in shell. */
function publicUser(req, user, { trainer } = {}) {
  const u = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete u.passwordHash;
  delete u.__v;
  if (u._id && !u.id) { u.id = String(u._id); delete u._id; }
  if (u.avatarUrl) u.avatarUrl = absoluteUrl(req, u.avatarUrl);
  if (Array.isArray(u.fcmTokens)) u.fcmTokens = u.fcmTokens.map((t) => ({ platform: t.platform, createdAt: t.createdAt }));
  if (trainer) {
    u.trainer = {
      id: String(trainer._id || trainer.id),
      name: trainer.name,
      email: trainer.email,
      phone: trainer.phone,
      avatarUrl: trainer.avatarUrl ? absoluteUrl(req, trainer.avatarUrl) : null,
      title: (trainer.trainerProfile && trainer.trainerProfile.title) || null,
      studio: (trainer.trainerProfile && trainer.trainerProfile.studio) || null,
      firstName: String(trainer.name || '').split(' ')[0],
    };
  }
  return u;
}

async function populateTrainer(user) {
  if (!user || user.role !== 'client') return null;
  const trainerId = user.clientProfile && user.clientProfile.trainerId;
  if (!trainerId) return null;
  const { User } = require('../models');
  if (trainerId.name) return trainerId; // already populated
  return User.findById(trainerId).select('name email phone avatarUrl trainerProfile role');
}

const normalisePhone = (v) => String(v || '').replace(/[^\d+]/g, '');

/** Resolve a login `identifier` (email OR phone) to a user, password included. */
async function findByIdentifier(identifier, { withPassword = false } = {}) {
  const { User } = require('../models');
  const raw = String(identifier || '').trim();
  const isEmail = EMAIL_RE.test(raw);

  let query;
  if (isEmail) {
    query = { email: raw.toLowerCase() };
  } else {
    const digits = normalisePhone(raw);
    const last8 = digits.slice(-8);
    // Phones are stored however the user typed them, so match on the digits.
    query = {
      $or: [
        { phone: raw },
        { phone: digits },
        ...(last8.length >= 6 ? [{ phone: new RegExp(`${last8}$`) }] : []),
      ],
    };
  }
  const q = User.findOne(query);
  if (withPassword) q.select('+passwordHash');
  return q;
}

/* ------------------------------------------------------------------ */
/* POST /api/auth/register                                            */
/* ------------------------------------------------------------------ */
exports.register = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const { name, email, phone, password, locale } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.isVerified) {
      throw new ApiError(409, 'EMAIL_IN_USE', 'An account with that email already exists');
    }
    // Un-verified signup being retried: refresh the password + resend the code.
    existing.name = name;
    existing.phone = phone || existing.phone;
    existing.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await existing.save();
    const sent = await otpService.issue({ user: existing, purpose: 'verify' });
    return created(res, {
      userId: String(existing._id),
      otpSent: true,
      destination: sent.destination,
      maskedDestination: sent.maskedDestination,
      channel: sent.channel,
      devCode: sent.devCode,
    });
  }

  if (phone) {
    const phoneTaken = await User.findOne({ phone });
    if (phoneTaken) throw new ApiError(409, 'PHONE_IN_USE', 'An account with that phone already exists');
  }

  // New clients are auto-attached to the single seeded trainer when there is
  // exactly one, so the demo works without an admin step.
  const trainers = await User.find({ role: 'trainer', isActive: true }).select('_id name').limit(2);
  const trainerId = trainers.length === 1 ? trainers[0]._id : undefined;

  const user = await User.create({
    name,
    email,
    phone,
    passwordHash: await bcrypt.hash(password, BCRYPT_COST),
    role: 'client',
    isVerified: false,
    locale: locale || 'en',
    clientProfile: { trainerId, onboardingCompleted: false },
  });

  const sent = await otpService.issue({ user, purpose: 'verify' });

  logger.info({ userId: String(user._id), email }, '[auth] registered');

  return created(res, {
    userId: String(user._id),
    otpSent: true,
    destination: sent.destination,
    maskedDestination: sent.maskedDestination,
    channel: sent.channel,
    devCode: sent.devCode,
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/login  — { identifier, password, remember? }        */
/* NO role in the request; the server returns user.role.             */
/* ------------------------------------------------------------------ */
exports.login = asyncHandler(async (req, res) => {
  const { identifier, password, remember } = req.body;

  const user = await findByIdentifier(identifier, { withPassword: true });
  // Identical message either way so we never confirm which emails exist.
  const invalid = new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong email/phone or password');
  if (!user) throw invalid;
  if (!user.isActive) throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');

  // Model method: falls back to re-reading passwordHash if it was not selected.
  const match = typeof user.comparePassword === 'function'
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, user.passwordHash || '');
  if (!match) throw invalid;

  if (!user.isVerified) {
    // 403 + userId so the app can jump straight to the OTP screen.
    throw new ApiError(403, 'NOT_VERIFIED', 'Verify your account to continue', {
      userId: String(user._id),
      destination: otpService.maskDestination(user.email || user.phone),
    });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = tokenService.issuePair(user, { remember: !!remember });
  const trainer = await populateTrainer(user);

  logger.info({ userId: String(user._id), role: user.role }, '[auth] login');

  return ok(res, { ...tokens, user: publicUser(req, user, { trainer }) });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/verify-otp                                          */
/* ------------------------------------------------------------------ */
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { userId, destination, code, purpose } = req.body;

  const user = userId
    ? await require('../models').User.findById(userId)
    : await findByIdentifier(destination);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'No account matches that request');

  await otpService.verify({ user, code, purpose, destination });

  if (purpose === 'reset') {
    return ok(res, { resetToken: tokenService.signResetToken(user), userId: String(user._id) });
  }

  const wasUnverified = !user.isVerified;
  if (wasUnverified) {
    user.isVerified = true;
    await user.save();

    // A brand-new client landing on a trainer's roster (CONTRACT §7 triggers).
    const trainerId = user.role === 'client' && user.clientProfile && user.clientProfile.trainerId;
    if (trainerId) {
      const { emitToCoach } = require('../realtime/emit');
      emitToCoach(trainerId, 'roster:updated', { trainerId: String(trainerId) });
      await notificationService.notify(trainerId, {
        type: 'new_client',
        title: 'New client joined',
        body: `${user.name} just created an account and is on your roster.`,
        data: { clientId: String(user._id) },
        deepLink: `firon://clients/${user._id}`,
      });
    }
  }

  const tokens = tokenService.issuePair(user);
  const trainer = await populateTrainer(user);
  return ok(res, { ...tokens, user: publicUser(req, user, { trainer }), verified: true });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/forgot-password                                     */
/* ------------------------------------------------------------------ */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { identifier, channel } = req.body;
  const user = await findByIdentifier(identifier);

  if (!user) {
    // Do not leak which accounts exist.
    logger.warn({ identifier }, '[auth] forgot-password for unknown identifier');
    return ok(res, {
      otpSent: true,
      destination: otpService.maskDestination(identifier),
      channel: channel || 'email',
    });
  }

  const sent = await otpService.issue({ user, purpose: 'reset', channel });
  return ok(res, {
    userId: String(user._id),
    otpSent: true,
    destination: sent.destination,
    maskedDestination: sent.maskedDestination,
    channel: sent.channel,
    devCode: sent.devCode,
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/reset-password                                      */
/* ------------------------------------------------------------------ */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password } = req.body;
  const payload = tokenService.verifyResetToken(resetToken);

  const { User } = require('../models');
  const user = await User.findById(payload.sub).select('+passwordHash');
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'No account matches that token');
  // A reset token is single-use: the successful reset below bumps tokenVersion,
  // so replaying the same token no longer matches the stored version.
  if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    throw new ApiError(401, 'TOKEN_REVOKED', 'That reset link has already been used — request a new code');
  }

  user.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  user.isVerified = true;
  // Resetting a password kills every existing session.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  const tokens = tokenService.issuePair(user);
  const trainer = await populateTrainer(user);
  logger.info({ userId: String(user._id) }, '[auth] password reset');
  return ok(res, { ...tokens, user: publicUser(req, user, { trainer }), reset: true });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/resend-otp                                          */
/* ------------------------------------------------------------------ */
exports.resendOtp = asyncHandler(async (req, res) => {
  const { userId, destination, purpose, channel } = req.body;
  const user = userId
    ? await require('../models').User.findById(userId)
    : await findByIdentifier(destination);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'No account matches that request');

  const sent = await otpService.issue({ user, purpose, channel });
  return ok(res, {
    userId: String(user._id),
    otpSent: true,
    destination: sent.destination,
    maskedDestination: sent.maskedDestination,
    channel: sent.channel,
    devCode: sent.devCode,
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/refresh                                             */
/* ------------------------------------------------------------------ */
exports.refresh = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await tokenService.rotateRefresh(req.body.refreshToken);
  const trainer = await populateTrainer(user);
  return ok(res, { accessToken, refreshToken, user: publicUser(req, user, { trainer }) });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/logout                                              */
/* ------------------------------------------------------------------ */
exports.logout = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const deviceToken = req.body.fcmToken || req.body.token;

  if (deviceToken) {
    await User.updateOne({ _id: req.user._id }, { $pull: { fcmTokens: { token: deviceToken } } });
  }
  // Bump tokenVersion: revokes the refresh token (and every access token).
  await tokenService.revokeAllTokens(req.user._id);

  logger.info({ userId: String(req.user._id) }, '[auth] logout');
  return ok(res, { loggedOut: true });
});

/* ------------------------------------------------------------------ */
/* GET /api/auth/me                                                   */
/* ------------------------------------------------------------------ */
exports.me = asyncHandler(async (req, res) => {
  const trainer = await populateTrainer(req.user);
  const unread = await notificationService.unreadCount(req.user._id);
  return ok(res, { user: publicUser(req, req.user, { trainer }), unreadNotifications: unread });
});

/* ------------------------------------------------------------------ */
/* POST / DELETE /api/auth/fcm-token                                  */
/* ------------------------------------------------------------------ */
exports.addFcmToken = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const { token, platform } = req.body;

  // One row per token, globally (a device can change hands).
  await User.updateMany({ 'fcmTokens.token': token }, { $pull: { fcmTokens: { token } } });
  await User.updateOne(
    { _id: req.user._id },
    { $push: { fcmTokens: { token, platform, createdAt: new Date() } } },
  );
  return ok(res, { registered: true, platform });
});

exports.removeFcmToken = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  await User.updateOne({ _id: req.user._id }, { $pull: { fcmTokens: { token: req.body.token } } });
  return ok(res, { removed: true });
});

exports.publicUser = publicUser;
exports.populateTrainer = populateTrainer;
exports.findByIdentifier = findByIdentifier;
