'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { escapeRegex } = require('../utils/text');
const videoService = require('../services/videoService');
const planService = require('../services/planService');
const { absoluteUrl } = require('../utils/urls');

/**
 * GET /api/search?q= -> { videos, plans, exercises }
 * Scoped to what the caller may see: clients search their own plans, trainers
 * search their roster's plans, admins search everything.
 */
exports.search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return ok(res, { videos: [], plans: [], exercises: [] }, { q, empty: true });

  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const rx = new RegExp(escapeRegex(q), 'i');
  const { Video, Exercise, TrainingPlan, DietPlan, MediaAsset } = require('../models');

  /* ---- videos (respecting publish + media-approval visibility) ---- */
  const videoFilter = { $or: [{ title: rx }, { description: rx }, { category: rx }, { tags: rx }] };
  if (!req.user || req.user.role !== 'admin') {
    const approved = await MediaAsset.find({ status: 'approved' }).select('_id').lean();
    const approvedIds = approved.map((m) => m._id);
    videoFilter.isPublished = true;
    videoFilter.$and = [{
      $or: [
        { videoMediaId: { $in: approvedIds } },
        { videoMediaId: { $exists: false } },
        { videoMediaId: null },
      ],
    }];
  }

  const videoDocs = await Video.find(videoFilter)
    .populate('videoMediaId', 'kind status url thumbnailUrl durationSec')
    .populate('thumbnailMediaId', 'kind status url thumbnailUrl')
    .populate('categoryId', 'name slug')
    .limit(limit);

  const progress = await videoService.progressMapFor(
    req.user && req.user._id,
    videoDocs.map((v) => v._id),
  );
  const videos = videoDocs.map((v) => videoService.serialiseVideo(req, v, progress));

  /* ---- plans (training + diet), scoped by role ---- */
  const planScope = {};
  if (req.user) {
    if (req.user.role === 'client') planScope.clientId = req.user._id;
    else if (req.user.role === 'trainer') planScope.trainerId = req.user._id;
  }

  const [trainingPlans, dietPlans] = await Promise.all([
    TrainingPlan.find({ ...planScope, $or: [{ name: rx }, { 'days.title': rx }, { 'days.exercises.name': rx }] })
      .populate('clientId', 'name')
      .limit(limit)
      .lean(),
    DietPlan.find({ ...planScope, $or: [{ name: rx }, { 'meals.food': rx }, { 'meals.slot': rx }] })
      .populate('clientId', 'name')
      .limit(limit)
      .lean(),
  ]);

  const plans = [
    ...trainingPlans.map((p) => ({
      id: String(p._id),
      kind: 'training',
      title: p.name,
      subtitle: 'Workout plan',
      label: planService.planLabel(p),
      status: p.status,
      clientName: p.clientId ? p.clientId.name : null,
      adherencePct: planService.adherencePct(p),
      // Matching day titles are the most useful thing to surface.
      matches: (p.days || []).filter((d) => rx.test(d.title || '')).map((d) => d.title),
    })),
    ...dietPlans.map((p) => ({
      id: String(p._id),
      kind: 'diet',
      title: p.name,
      subtitle: 'Nutrition plan',
      label: p.name,
      status: p.status,
      clientName: p.clientId ? p.clientId.name : null,
      kcal: p.kcal || planService.dietTotals(p).kcal,
      matches: (p.meals || []).filter((m) => rx.test(m.food || '') || rx.test(m.slot || '')).map((m) => m.food),
    })),
  ].slice(0, limit);

  /* ---- exercises ---- */
  const exerciseDocs = await Exercise.find({
    isActive: { $ne: false },
    $or: [{ name: rx }, { muscleGroup: rx }, { equipment: rx }, { type: rx }],
  })
    .populate('demoMediaId', 'url thumbnailUrl status')
    .limit(limit)
    .lean();

  const exercises = exerciseDocs.map((e) => ({
    id: String(e._id),
    name: e.name,
    type: e.type || null,
    muscleGroup: e.muscleGroup || null,
    equipment: e.equipment || null,
    demoDurationLabel: e.demoDurationLabel || null,
    demoUrl: e.demoMediaId && e.demoMediaId.url ? absoluteUrl(req, e.demoMediaId.url) : null,
  }));

  return ok(
    res,
    { videos, plans, exercises },
    { q, counts: { videos: videos.length, plans: plans.length, exercises: exercises.length } },
  );
});
