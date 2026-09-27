'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { initials } = require('../utils/text');
const { absoluteUrl } = require('../utils/urls');
const planService = require('../services/planService');
const { DAYS } = require('../validators/trainer.validators');

const DEFAULT_AVAILABILITY = DAYS.map((day) => ({
  day,
  off: day === 'Sun',
  from: day === 'Sat' ? '09:00' : '07:00',
  to: day === 'Sat' ? '13:00' : '19:00',
}));

/** Collapses the 7-day list into 'Mon–Fri · 07:00 – 19:00' style rows. */
function availabilitySummary(availability = []) {
  const key = (d) => (d.off ? 'off' : `${d.from}-${d.to}`);
  const parts = [];
  let i = 0;
  while (i < availability.length) {
    let j = i;
    while (j + 1 < availability.length && key(availability[j + 1]) === key(availability[i])) j += 1;
    const label = i === j ? availability[i].day : `${availability[i].day}–${availability[j].day}`;
    parts.push(`${label} · ${availability[i].off ? 'Off' : `${availability[i].from} – ${availability[i].to}`}`);
    i = j + 1;
  }
  return parts;
}

function trainerPayload(req, user) {
  const tp = (user.trainerProfile && (user.trainerProfile.toObject ? user.trainerProfile.toObject() : user.trainerProfile)) || {};
  const availability = (tp.availability && tp.availability.length === 7) ? tp.availability : DEFAULT_AVAILABILITY;
  return {
    id: String(user._id),
    name: user.name,
    initials: initials(user.name),
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl ? absoluteUrl(req, user.avatarUrl) : null,
    role: user.role,
    isVerified: user.isVerified,
    title: tp.title || null,
    studio: tp.studio || null,
    rate: tp.rate || null,
    since: tp.since || null,
    certs: tp.certs || [],
    availability,
    availabilitySummary: availabilitySummary(availability),
    openDays: availability.filter((d) => !d.off).length,
    prefs: {
      newClientRequests: tp.prefs ? tp.prefs.newClientRequests !== false : true,
      sessionReminders: tp.prefs ? tp.prefs.sessionReminders !== false : true,
      weeklyAdherenceReport: tp.prefs ? !!tp.prefs.weeklyAdherenceReport : false,
    },
  };
}

/* GET /api/trainer/profile */
exports.getProfile = asyncHandler(async (req, res) => ok(res, trainerPayload(req, req.user)));

/* PUT /api/trainer/profile */
exports.updateProfile = asyncHandler(async (req, res) => {
  const tp = (req.user.trainerProfile && (req.user.trainerProfile.toObject ? req.user.trainerProfile.toObject() : req.user.trainerProfile)) || {};
  const { name, ...rest } = req.body;
  if (name) req.user.name = name;
  req.user.trainerProfile = { ...tp, ...rest };
  req.user.markModified('trainerProfile');
  await req.user.save();
  return ok(res, trainerPayload(req, req.user));
});

/* GET /api/trainer/availability */
exports.getAvailability = asyncHandler(async (req, res) => {
  const p = trainerPayload(req, req.user);
  return ok(res, {
    availability: p.availability,
    summary: p.availabilitySummary,
    openDays: p.openDays,
  });
});

/**
 * PUT /api/trainer/availability
 * The validator enforces the prototype's saveAvailability() rule: exactly 7
 * entries, and `from < to` for every day that is not marked off.
 */
exports.updateAvailability = asyncHandler(async (req, res) => {
  const tp = (req.user.trainerProfile && (req.user.trainerProfile.toObject ? req.user.trainerProfile.toObject() : req.user.trainerProfile)) || {};
  req.user.trainerProfile = { ...tp, availability: req.body.availability };
  req.user.markModified('trainerProfile');
  await req.user.save();

  const p = trainerPayload(req, req.user);
  return ok(res, {
    availability: p.availability,
    summary: p.availabilitySummary,
    openDays: p.openDays,
  });
});

/* PUT /api/trainer/prefs */
exports.updatePrefs = asyncHandler(async (req, res) => {
  const tp = (req.user.trainerProfile && (req.user.trainerProfile.toObject ? req.user.trainerProfile.toObject() : req.user.trainerProfile)) || {};
  req.user.trainerProfile = { ...tp, prefs: { ...(tp.prefs || {}), ...req.body } };
  req.user.markModified('trainerProfile');
  await req.user.save();
  return ok(res, trainerPayload(req, req.user).prefs);
});

/* GET /api/trainer/dashboard */
exports.dashboard = asyncHandler(async (req, res) => {
  const { User, TrainingPlan, SessionRecord, MediaAsset } = require('../models');
  const trainerId = req.user._id;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const clients = await User.find({ role: 'client', 'clientProfile.trainerId': trainerId })
    .select('name avatarUrl clientProfile lastLoginAt')
    .lean();
  const clientIds = clients.map((c) => c._id);

  const [plans, sessions, pendingMedia] = await Promise.all([
    TrainingPlan.find({ clientId: { $in: clientIds }, status: 'active' }).lean(),
    SessionRecord.find({
      trainerId,
      status: 'completed',
      completedAt: { $gte: weekAgo },
    }).sort({ completedAt: -1 }).limit(30).lean(),
    MediaAsset.countDocuments({ uploadedBy: trainerId, status: 'pending' }),
  ]);

  const withPlan = new Set(plans.map((p) => String(p.clientId)));
  const adherences = plans.map((p) => planService.adherencePct(p));
  const avgAdherence = adherences.length
    ? Math.round(adherences.reduce((a, b) => a + b, 0) / adherences.length)
    : 0;

  const byClient = {};
  clients.forEach((c) => { byClient[String(c._id)] = c; });

  const needsAttention = plans
    .map((p) => ({
      clientId: String(p.clientId),
      name: (byClient[String(p.clientId)] || {}).name,
      adherencePct: planService.adherencePct(p),
      planLabel: planService.planLabel(p),
    }))
    .filter((r) => r.adherencePct < 70)
    .sort((a, b) => a.adherencePct - b.adherencePct);

  return ok(res, {
    trainer: { id: String(trainerId), name: req.user.name, initials: initials(req.user.name) },
    stats: {
      activeClients: clientIds.filter((id) => withPlan.has(String(id))).length,
      totalClients: clientIds.length,
      sessionsThisWeek: sessions.length,
      newRequests: clientIds.length - withPlan.size,
      avgAdherence,
      pendingUploads: pendingMedia,
    },
    needsAttention,
    recentSessions: sessions.slice(0, 10).map((s) => ({
      id: String(s._id),
      clientId: String(s.clientId),
      clientName: (byClient[String(s.clientId)] || {}).name,
      title: s.title,
      durationMin: s.durationMin,
      completedAt: s.completedAt,
    })),
    availability: trainerPayload(req, req.user).availability,
  });
});

exports.availabilitySummary = availabilitySummary;
exports.DEFAULT_AVAILABILITY = DEFAULT_AVAILABILITY;
